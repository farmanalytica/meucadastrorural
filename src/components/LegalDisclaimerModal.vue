<script setup lang="ts">
// Popup exibido sobre o mapa com o disclaimer legal do projeto: descreve o
// pipeline/stack em linhas gerais e deixa claro que a infraestrutura é
// custeada pela FARM Analytica por liberalidade, não por obrigação. O
// projeto é open source e reproduzível via fork, justamente para que quem
// depender dele em produção não fique refém dessa infraestrutura.
import MapPopup from './MapPopup.vue'

defineEmits<{ close: [] }>()
</script>

<template>
  <MapPopup title="Disclaimer legal" @close="$emit('close')">
    <h3>Sobre o pipeline</h3>
    <p>
      Este site é uma aplicação estática (Vue + Leaflet), sem backend próprio. O fluxo dos dados,
      da fonte oficial até a tela, segue 4 etapas:
    </p>

    <ol class="step-flow">
      <li class="step-flow__step">
        <span class="step-flow__num">1</span>
        <div>
          <strong>Fontes oficiais</strong>
          <p>Governo Federal (SICAR) e IBGE publicam os limites de imóveis rurais, municípios e estados.</p>
        </div>
      </li>
      <li class="step-flow__step">
        <span class="step-flow__num">2</span>
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
      <li class="step-flow__step">
        <span class="step-flow__num">3</span>
        <div>
          <strong>Seu navegador</strong>
          <p>
            Ao navegar no mapa, o navegador baixa da nuvem só os arquivos da área visível. Ao
            clicar num imóvel, ele também consulta o SICAR ao vivo pelos dados oficiais atualizados
            daquele cadastro.
          </p>
        </div>
      </li>
      <li class="step-flow__step">
        <span class="step-flow__num">4</span>
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
      o site por razões fora de seu controle ou capacidade de arcar: custos de operação acima
      do viável, ataques cibernéticos ou indisponibilidade das fontes de dados oficiais (SICAR,
      IBGE).
    </p>

    <h3>Sobre os dados exibidos</h3>
    <p>
      A <strong>FARM Analytica não é produtora, provedora, curadora nem garantidora dos dados</strong>
      exibidos neste site. Todo o conteúdo (limites de imóveis rurais, municípios, estados,
      APPs e demais camadas) é obtido diretamente das fontes oficiais (SICAR, IBGE) e apenas
      repassado ao navegador do usuário, sem qualquer tratamento, validação, correção ou
      curadoria de mérito por parte da FARM Analytica.
    </p>
    <p>
      Os dados são disponibilizados <strong>"no estado em que se encontram" ("as is")</strong>,
      sem garantia de exatidão, integridade, atualização, disponibilidade ou adequação a
      qualquer finalidade. Erros, omissões, desatualizações ou inconsistências podem ter origem
      nas próprias fontes oficiais ou na indisponibilidade delas, e estão fora do controle da
      FARM Analytica.
    </p>
    <p>
      A FARM Analytica não se responsabiliza, sob nenhum aspecto — técnico, jurídico, financeiro
      ou de qualquer outra natureza —, por decisões, atos, contratos, disputas judiciais ou
      administrativas, prejuízos diretos ou indiretos, lucros cessantes ou danos de qualquer
      espécie decorrentes do uso, da interpretação ou da confiança depositada nos dados aqui
      exibidos. O uso das informações é de <strong>exclusiva responsabilidade do usuário</strong>,
      cabendo a ele conferir e validar qualquer dado junto às fontes oficiais antes de qualquer
      uso formal, jurídico ou decisório.
    </p>

    <h3>Recomendação para uso institucional</h3>
    <p>
      Como este é um projeto <strong>open source</strong>, todo o pipeline é reprodutível a partir
      de um fork do código-fonte. Recomenda-se que usuários e instituições que venham a depender
      deste sistema em seus fluxos de trabalho façam um fork e hospedem sua própria
      infraestrutura, em vez de depender exclusivamente desta instância pública.
    </p>

    <a
      class="popup-cta-link"
      href="https://github.com/farmanalytica/meucadastrorural"
      target="_blank"
      rel="noopener noreferrer"
    >
      Ver código-fonte no GitHub
    </a>
  </MapPopup>
</template>
