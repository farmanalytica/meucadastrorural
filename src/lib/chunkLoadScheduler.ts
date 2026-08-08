export interface ChunkLoadEntry {
    id: string;
}

export interface ChunkLoadContext {
    generation: number;
    signal: AbortSignal;
}

export interface ChunkLoadSchedulerOptions<TEntry extends ChunkLoadEntry, TData> {
    maxConcurrent: number;
    load: (entry: TEntry, context: ChunkLoadContext) => Promise<TData>;
    isLoaded: (chunkId: string) => boolean;
    isEnabled: () => boolean;
    onLoaded: (entry: TEntry, data: TData) => void;
    onError?: (error: unknown, entry: TEntry) => void;
}

export interface EnqueueChunkOptions {
    force?: boolean;
    generation?: number;
    priority?: 'high' | 'normal';
}

export interface ChunkLoadScheduler<TEntry extends ChunkLoadEntry> {
    startGeneration: () => number;
    isCurrentGeneration: (generation: number) => boolean;
    setDesiredEntries: (entries: readonly TEntry[], generation?: number) => boolean;
    getDesiredChunkIds: () => ReadonlySet<string>;
    enqueue: (entry: TEntry, options?: EnqueueChunkOptions) => boolean;
    enqueueAll: (entries: readonly TEntry[], options?: EnqueueChunkOptions) => void;
    cancel: () => number;
    destroy: () => void;
}

interface QueuedChunk<TEntry> {
    entry: TEntry;
    force: boolean;
    generation: number;
}

interface InflightChunk {
    controller: AbortController;
    generation: number;
}

/**
 * Coordinates chunk loading independently from the map/rendering implementation.
 * Cancellation is immediate for queued work and logical for resolved work. Loaders
 * may additionally consume the AbortSignal to cancel their underlying request.
 */
export function createChunkLoadScheduler<TEntry extends ChunkLoadEntry, TData>(
    options: ChunkLoadSchedulerOptions<TEntry, TData>,
): ChunkLoadScheduler<TEntry> {
    if (!Number.isInteger(options.maxConcurrent) || options.maxConcurrent < 1) {
        throw new RangeError('maxConcurrent must be a positive integer');
    }

    let activeGeneration = 0;
    let activeLoadCount = 0;
    let destroyed = false;
    let queue: Array<QueuedChunk<TEntry>> = [];
    let desiredEntries = new Map<string, TEntry>();

    const queuedChunkIds = new Set<string>();
    const inflightChunks = new Map<string, InflightChunk>();

    function reportError(error: unknown, entry: TEntry) {
        try {
            options.onError?.(error, entry);
        } catch {
            // Error reporting must not stall the queue.
        }
    }

    function clearQueue() {
        queue = [];
        queuedChunkIds.clear();
    }

    function invalidateGeneration() {
        activeGeneration += 1;
        desiredEntries = new Map();
        clearQueue();
        for (const inflight of inflightChunks.values()) {
            inflight.controller.abort();
        }
        return activeGeneration;
    }

    function shouldStart(request: QueuedChunk<TEntry>) {
        if (request.force) return true;
        return request.generation === activeGeneration && desiredEntries.has(request.entry.id);
    }

    function shouldApply(request: QueuedChunk<TEntry>) {
        if (destroyed || !options.isEnabled() || options.isLoaded(request.entry.id)) return false;
        if (request.force) return true;
        return request.generation === activeGeneration && desiredEntries.has(request.entry.id);
    }

    function enqueue(entry: TEntry, enqueueOptions: EnqueueChunkOptions = {}) {
        if (destroyed || !entry) return false;

        const generation = enqueueOptions.generation ?? activeGeneration;
        const force = Boolean(enqueueOptions.force);
        if (!force && generation !== activeGeneration) return false;
        if (options.isLoaded(entry.id) || inflightChunks.has(entry.id) || queuedChunkIds.has(entry.id)) {
            return false;
        }

        const request = { entry, generation, force };
        const priority = enqueueOptions.priority ?? (force ? 'high' : 'normal');
        if (priority === 'high') queue.unshift(request);
        else queue.push(request);
        queuedChunkIds.add(entry.id);
        drainQueue();
        return true;
    }

    function enqueueAll(entries: readonly TEntry[], enqueueOptions: EnqueueChunkOptions = {}) {
        for (const entry of entries) enqueue(entry, enqueueOptions);
    }

    function retryIfDesired(request: QueuedChunk<TEntry>) {
        if (destroyed || request.generation === activeGeneration) return;
        const latestEntry = desiredEntries.get(request.entry.id);
        if (!latestEntry || options.isLoaded(request.entry.id)) return;
        enqueue(latestEntry, { generation: activeGeneration });
    }

    function drainQueue() {
        while (!destroyed && activeLoadCount < options.maxConcurrent && queue.length > 0) {
            const request = queue.shift();
            if (!request) break;
            const { entry } = request;
            queuedChunkIds.delete(entry.id);

            if (!shouldStart(request) || options.isLoaded(entry.id) || inflightChunks.has(entry.id)) {
                continue;
            }

            const controller = new AbortController();
            activeLoadCount += 1;
            inflightChunks.set(entry.id, { controller, generation: request.generation });

            void (async () => {
                try {
                    const data = await options.load(entry, {
                        generation: request.generation,
                        signal: controller.signal,
                    });
                    if (shouldApply(request)) options.onLoaded(entry, data);
                } catch (error) {
                    if (!controller.signal.aborted) reportError(error, entry);
                } finally {
                    inflightChunks.delete(entry.id);
                    activeLoadCount = Math.max(0, activeLoadCount - 1);
                    retryIfDesired(request);
                    drainQueue();
                }
            })();
        }
    }

    function startGeneration() {
        if (destroyed) return activeGeneration;
        return invalidateGeneration();
    }

    function setDesiredEntries(entries: readonly TEntry[], generation = activeGeneration) {
        if (destroyed || generation !== activeGeneration) return false;
        desiredEntries = new Map(entries.map((entry) => [entry.id, entry]));
        clearQueue();
        return true;
    }

    function cancel() {
        if (destroyed) return activeGeneration;
        return invalidateGeneration();
    }

    function destroy() {
        if (destroyed) return;
        invalidateGeneration();
        destroyed = true;
    }

    return {
        startGeneration,
        isCurrentGeneration: (generation) => generation === activeGeneration,
        setDesiredEntries,
        getDesiredChunkIds: () => new Set(desiredEntries.keys()),
        enqueue,
        enqueueAll,
        cancel,
        destroy,
    };
}
