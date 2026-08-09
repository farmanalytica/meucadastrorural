<script setup lang="ts">
// Popup exibido sobre o mapa explicando as funcionalidades do site e como
// usá-las, na ordem em que um usuário costuma percorrê-las: buscar, ligar
// camadas, selecionar um imóvel, consultar dados oficiais, baixar arquivos.
import MapPopup from './MapPopup.vue'

defineEmits<{ close: [] }>()
</script>

<template>
  <MapPopup title="Como usar" @close="$emit('close')">
    <p>Guia rápido das funcionalidades do mapa, na ordem em que costumam ser usadas:</p>

    <ol class="step-flow">
      <li class="step-flow__step">
        <span class="step-flow__num">1</span>
        <div>
          <strong>Buscar um lugar ou um imóvel</strong>
          <p>
            Na caixa de busca do canto superior esquerdo, digite um código do CAR (ex.:
            <code>GO-5213103-…</code>), um endereço ou coordenadas (ex.: <code>-16.68, -49.25</code>)
            e pressione Enter ou escolha um resultado da lista.
          </p>
        </div>
      </li>
      <li class="step-flow__step">
        <span class="step-flow__num">2</span>
        <div>
          <strong>Ligar e desligar camadas</strong>
          <p>
            No painel "Camadas" (canto superior direito), ligue ou desligue Imóveis CAR, Estados e
            Municípios. Com Imóveis CAR ligado, ajuste a transparência do contorno pelo controle
            deslizante logo abaixo.
          </p>
        </div>
      </li>
      <li class="step-flow__step">
        <span class="step-flow__num">3</span>
        <div>
          <strong>Selecionar um imóvel no mapa</strong>
          <p>
            Aproxime o mapa até os contornos aparecerem e clique sobre um imóvel. O painel do
            imóvel selecionado abre no canto inferior direito.
          </p>
        </div>
      </li>
      <li class="step-flow__step">
        <span class="step-flow__num">4</span>
        <div>
          <strong>Consultar dados oficiais do SICAR</strong>
          <p>
            No painel do imóvel selecionado, clique em "Dados oficiais" pra ver status, área e
            módulos fiscais direto da base pública do SICAR.
          </p>
        </div>
      </li>
      <li class="step-flow__step">
        <span class="step-flow__num">5</span>
        <div>
          <strong>Ver a Área de Preservação Permanente (APP)</strong>
          <p>
            Com um imóvel selecionado, ligue a camada "Área de Preservação Permanente (APP)" no
            painel de camadas pra sobrepor a APP ao contorno do imóvel.
          </p>
        </div>
      </li>
      <li class="step-flow__step">
        <span class="step-flow__num">6</span>
        <div>
          <strong>Baixar os arquivos</strong>
          <p>
            No painel do imóvel selecionado, baixe o contorno em KML ou a APP em GeoJSON, pra abrir
            em outro programa de mapa (Google Earth, QGIS etc.).
          </p>
        </div>
      </li>
      <li class="step-flow__step">
        <span class="step-flow__num">7</span>
        <div>
          <strong>Compartilhar um imóvel direto</strong>
          <p>
            Adicione <code>?car=&lt;código do CAR&gt;</code> ao final do endereço do site pra abrir
            o mapa já com aquele imóvel selecionado.
          </p>
        </div>
      </li>
    </ol>
  </MapPopup>
</template>

<style scoped>
.popup-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: var(--bg);
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
}
</style>
