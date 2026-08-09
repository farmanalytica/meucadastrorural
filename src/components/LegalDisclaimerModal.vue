<script setup lang="ts">
// Popup exibido sobre o mapa com o disclaimer legal do projeto: descreve o
// pipeline/stack em linhas gerais e deixa claro que a infraestrutura é
// custeada pela FARM Analytica por liberalidade, não por obrigação. O
// projeto é open source e reproduzível via fork, justamente para que quem
// depender dele em produção não fique refém dessa infraestrutura.
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="disclaimer-overlay" @click.self="$emit('close')">
      <div class="disclaimer-modal" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
        <button class="disclaimer-modal__close" title="Fechar" @click="$emit('close')">×</button>
        <h2 id="disclaimer-title">Disclaimer legal</h2>

        <h3>Sobre o pipeline</h3>
        <p>
          Este site é uma aplicação estática (Vue + Leaflet), sem backend próprio. O fluxo dos dados,
          da fonte oficial até a tela, segue 4 etapas:
        </p>

        <ol class="pipeline-flow">
          <li class="pipeline-flow__step">
            <span class="pipeline-flow__num">1</span>
            <div>
              <strong>Fontes oficiais</strong>
              <p>Governo Federal (SICAR) e IBGE publicam os limites de imóveis rurais, municípios e estados.</p>
            </div>
          </li>
          <li class="pipeline-flow__step">
            <span class="pipeline-flow__num">2</span>
            <div>
              <strong>Preparação</strong>
              <p>
                Uma vez por mês, quando a base do SICAR é atualizada, os zips (organizados por
                estado) são baixados e reorganizados em arquivos menores por região, guardados
                prontos em um serviço de nuvem (Amazon S3), pra carregar rápido no mapa. Esse
                processo de download é documentado em outro repositório,
                <a
                  href="https://github.com/farmanalytica/automacao_download_car_sicar"
                  target="_blank"
                  rel="noopener noreferrer"
                  >automacao_download_car_sicar</a
                >.
              </p>
            </div>
          </li>
          <li class="pipeline-flow__step">
            <span class="pipeline-flow__num">3</span>
            <div>
              <strong>Seu navegador</strong>
              <p>
                Ao navegar no mapa, o navegador baixa da nuvem só os arquivos da área visível. Ao
                clicar num imóvel, ele também consulta o SICAR ao vivo pelos dados oficiais atualizados
                daquele cadastro.
              </p>
            </div>
          </li>
          <li class="pipeline-flow__step">
            <span class="pipeline-flow__num">4</span>
            <div>
              <strong>Resultado no seu computador</strong>
              <p>
                O mapa é desenhado e os arquivos que você baixa (KML, GeoJSON) são gerados no próprio
                navegador, sem passar pelos servidores da FARM Analytica.
              </p>
            </div>
          </li>
        </ol>

        <h3>Sobre a infraestrutura</h3>
        <p>
          Domínio, hospedagem e distribuição deste projeto são infraestrutura custeada
          voluntariamente pela <strong>FARM Analytica</strong>, sem obrigação contratual de fazê-lo.
          Por isso a FARM Analytica se reserva o direito de, eventualmente, deixar de disponibilizar
          o site por razões fora de seu controle ou capacidade de arcar (ex.: custos de operação
          acima do viável, ataques cibernéticos, indisponibilidade das fontes de dados oficiais,
          entre outros).
        </p>

        <h3>Recomendação para uso institucional</h3>
        <p>
          Como este é um projeto <strong>open source</strong>, todo o pipeline é reprodutível a partir
          de um fork do código-fonte. Recomenda-se que usuários e instituições que venham a depender
          deste sistema em seus fluxos de trabalho façam um fork e hospedem sua própria
          infraestrutura, em vez de depender exclusivamente desta instância pública.
        </p>

        <a
          class="disclaimer-modal__repo-link"
          href="https://github.com/farmanalytica/meucadastrorural"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver código-fonte no GitHub
        </a>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.disclaimer-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(17, 24, 39, 0.55);
}

.disclaimer-modal {
  position: relative;
  width: 560px;
  max-width: 100%;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  background: #fbfcfb;
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--sh-lg);
  padding: 1.5rem 1.5rem 1.25rem;
}

.disclaimer-modal h2 {
  margin: 0 1.5rem 0.9rem 0;
  font-size: 1.1rem;
  color: var(--primary);
}

.disclaimer-modal h3 {
  margin: 1rem 0 0.35rem;
  font-size: 0.82rem;
  color: var(--primary);
}

.disclaimer-modal h3:first-of-type {
  margin-top: 0;
}

.disclaimer-modal p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text);
}

.disclaimer-modal__close {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  color: var(--text-soft);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.disclaimer-modal__close:hover {
  background: var(--bg);
  color: var(--text);
}

.pipeline-flow {
  list-style: none;
  margin: 0.9rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.pipeline-flow__step {
  position: relative;
  display: flex;
  gap: 0.7rem;
  padding: 0 0 1.1rem;
}

.pipeline-flow__step:last-child {
  padding-bottom: 0;
}

.pipeline-flow__step:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 0.85rem;
  top: 1.9rem;
  bottom: 0.15rem;
  width: 2px;
  background: var(--border);
}

.pipeline-flow__num {
  flex: none;
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  z-index: 1;
}

.pipeline-flow__step strong {
  display: block;
  font-size: 0.82rem;
  color: var(--text);
}

.pipeline-flow__step p {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  line-height: 1.45;
}

.pipeline-flow__step p a {
  color: var(--primary);
  font-weight: 650;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.disclaimer-modal__repo-link {
  display: inline-block;
  margin-top: 1.1rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
