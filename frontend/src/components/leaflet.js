// O plugin de agrupamento de marcadores procura o Leaflet em window.L: este arquivo carrega antes.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

window.L = L

export default L
