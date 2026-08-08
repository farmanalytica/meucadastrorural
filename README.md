# Meu Cadastro Rural

Consulta pública do CAR (Cadastro Ambiental Rural), 100% estática — publicada no
GitHub Pages, sem backend.

**Site:** https://meucadastrorural.com.br

## Funcionalidades

- Visualização dos limites dos imóveis CAR (SICAR) sobre imagem de satélite
- Limites de estados e municípios (IBGE), com liga/desliga por camada
- Busca por código do CAR (ex.: `GO-5213103-…`), por endereço ou por coordenadas
- Download do contorno do imóvel em KML
- Dados oficiais do SICAR (status, área, módulos fiscais etc.) via WFS público
- Link direto para um imóvel: `/?car=<código do CAR>`

## Fontes de dados (consumidas pelo navegador)

| Dado | Fonte |
| --- | --- |
| Polígonos CAR (overlay) | Bucket S3 público com GeoJSON em chunks + índice por UF |
| Dados oficiais do imóvel | `geoserver.car.gov.br` (WFS público do SICAR) |
| Estados e municípios | GeoJSON estáticos em `public/geo/` (malhas IBGE) |
| Endereços | Photon (autocomplete) e Nominatim (geocodificação) |
| Imagem de satélite | Esri World Imagery |

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:5173/
npm run build      # gera dist/
npm run typecheck
```

O deploy é automático: push na branch `main` dispara o workflow
`.github/workflows/deploy.yml`, que faz o build e publica no GitHub Pages.

Código do mapa portado de [monitoramentofarm](https://github.com/farmanalytica/monitoramentofarm)
(subconjunto somente-leitura, sem autenticação).
