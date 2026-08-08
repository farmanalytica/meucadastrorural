<script setup lang="ts">
// Fixed bottom bar over the map, modeled on the farm_tools website footer:
// dark primary background, white FARM Analytica logo, open-source note.
const base = import.meta.env.BASE_URL
</script>

<template>
  <footer class="footer">
    <a href="https://farmanalytica.com.br" target="_blank" rel="noopener noreferrer">
      <img class="footer__logo" :src="`${base}farm_analytica_horizontal_white.svg`" alt="FARM Analytica" />
    </a>
    <span class="footer__text">
      <a
        class="footer__link"
        href="https://github.com/farmanalytica/meucadastrorural"
        target="_blank"
        rel="noopener noreferrer"
        >Projeto de código aberto</a
      >
      patrocinado pela
      <a
        class="footer__link"
        href="https://farmanalytica.com.br"
        target="_blank"
        rel="noopener noreferrer"
        >FARM Analytica</a
      >.
    </span>
    <span class="footer__credits">
      Dados:
      <a class="footer__link" href="https://www.car.gov.br/" target="_blank" rel="noopener noreferrer">SICAR</a>
      ·
      <a class="footer__link" href="https://www.ibge.gov.br/" target="_blank" rel="noopener noreferrer">IBGE</a>
    </span>
  </footer>
</template>

<style scoped>
.footer {
  position: absolute;
  z-index: 30;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  padding: 0.45rem 1rem;
  background: rgba(24, 63, 58, 0.92);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.74rem;
  line-height: 1.3;
}

.footer__logo {
  display: block;
  height: 20px;
  width: auto;
  object-fit: contain;
  opacity: 0.85;
}

.footer__logo:hover {
  opacity: 1;
}

.footer__link {
  color: inherit;
  text-decoration: underline;
}

.footer__link:hover {
  color: #fff;
}

.footer__credits {
  color: rgba(255, 255, 255, 0.45);
}

@media (max-width: 640px) {
  .footer__credits {
    display: none;
  }
}
</style>
