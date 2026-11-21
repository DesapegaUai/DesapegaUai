import { useEffect, useRef } from 'react';
import L from './leaflet.js';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { formatarPreco } from '../services/formatar.js';
import '../styles/marketplace-mapa.css';

// Mapa do OpenStreetMap. Para trocar de servidor de mapas, use VITE_MAPA_TILES no .env do front.
const TILES = import.meta.env.VITE_MAPA_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUICAO = import.meta.env.VITE_MAPA_ATRIBUICAO || '&copy; colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const escapar = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function caixaDoMapa(mapa) {
  const b = mapa.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(',');
}

/**
 * Mapa de anúncios. Os pontos dos anúncios são os aproximados que a API devolve (nunca o exato).
 * - centro e raioKm: desenha o círculo da busca
 * - usuario: sua posição do GPS, com o círculo da precisão
 * - marcadores: anúncios (agrupados quando ficam perto demais)
 * - area: um anúncio só, mostrado como um círculo de raioM em volta do ponto aproximado
 * - ponto + onEscolherPonto: clique (ou arraste o alfinete) para escolher um lugar
 * - onMover(bbox): a área visível mudou
 */
export default function MapaAnuncios({ centro, raioKm, usuario, marcadores = [], area, ponto, onEscolherPonto, onMover, zoom = 13, altura = 420, rotulo = 'Mapa' }) {
  const caixaRef = useRef(null);
  const mapaRef = useRef(null);
  const camadas = useRef({});
  const aoMover = useRef(onMover);
  const aoEscolher = useRef(onEscolherPonto);
  useEffect(() => {
    aoMover.current = onMover;
    aoEscolher.current = onEscolherPonto;
  });

  // cria o mapa uma vez
  useEffect(() => {
    const mapa = L.map(caixaRef.current, { zoomControl: false, attributionControl: true }).setView([-20.7547, -42.8819], zoom);
    L.control.zoom({ zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar', position: 'topright' }).addTo(mapa);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATRIBUICAO }).addTo(mapa);
    mapa.attributionControl.setPrefix(false);
    camadas.current.grupo = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 }).addTo(mapa);
    let espera = null;
    mapa.on('moveend', () => {
      clearTimeout(espera);
      espera = setTimeout(() => aoMover.current?.(caixaDoMapa(mapa)), 300);
    });
    mapa.on('click', (e) => aoEscolher.current?.({ latitude: Number(e.latlng.lat.toFixed(7)), longitude: Number(e.latlng.lng.toFixed(7)) }));
    mapaRef.current = mapa;
    aoMover.current?.(caixaDoMapa(mapa));
    return () => {
      clearTimeout(espera);
      mapa.remove();
      mapaRef.current = null;
    };
  }, [zoom]);

  // centro e círculo do raio
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !centro) return;
    camadas.current.raio?.remove();
    if (raioKm) {
      camadas.current.raio = L.circle([centro.latitude, centro.longitude], { radius: raioKm * 1000, color: '#3E8B22', weight: 1.5, dashArray: '6 6', fillOpacity: 0.04, interactive: false }).addTo(mapa);
      mapa.fitBounds(camadas.current.raio.getBounds(), { padding: [12, 12], maxZoom: 16 });
    } else {
      mapa.setView([centro.latitude, centro.longitude], mapa.getZoom());
    }
  }, [centro?.latitude, centro?.longitude, raioKm]); // eslint-disable-line react-hooks/exhaustive-deps

  // posição do usuário
  useEffect(() => {
    const mapa = mapaRef.current;
    camadas.current.usuario?.remove();
    camadas.current.precisao?.remove();
    if (!mapa || !usuario) return;
    if (usuario.precisao_m) {
      camadas.current.precisao = L.circle([usuario.latitude, usuario.longitude], { radius: usuario.precisao_m, color: '#2563EB', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(mapa);
    }
    camadas.current.usuario = L.circleMarker([usuario.latitude, usuario.longitude], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 })
      .bindTooltip('Você está aqui').addTo(mapa);
  }, [usuario?.latitude, usuario?.longitude, usuario?.precisao_m]); // eslint-disable-line react-hooks/exhaustive-deps

  // marcadores dos anúncios
  useEffect(() => {
    const grupo = camadas.current.grupo;
    if (!grupo) return;
    grupo.clearLayers();
    for (const m of marcadores) {
      const icone = L.divIcon({ className: 'mapa-preco', html: `<span>${escapar(formatarPreco(m.preco))}</span>`, iconSize: null });
      const foto = m.foto ? `<img src="${escapar(m.foto)}" alt="" width="64" height="48">` : '';
      L.marker([m.latitude, m.longitude], { icon: icone, title: m.titulo, keyboard: true })
        .bindPopup(`<a class="mapa-popup" href="/anuncio/${Number(m.id)}">${foto}<span><b>${escapar(m.titulo)}</b><i>${escapar(formatarPreco(m.preco))} · ${escapar(m.bairro ?? '')}</i></span></a>`)
        .addTo(grupo);
    }
  }, [marcadores]);

  // um anúncio: área aproximada
  useEffect(() => {
    const mapa = mapaRef.current;
    camadas.current.area?.remove();
    if (!mapa || !area) return;
    camadas.current.area = L.circle([area.latitude, area.longitude], { radius: area.raioM || 250, color: '#3E8B22', weight: 1.5, fillOpacity: 0.15 })
      .bindTooltip(area.rotulo ?? 'Região aproximada').addTo(mapa);
    mapa.fitBounds(camadas.current.area.getBounds(), { padding: [30, 30], maxZoom: 16 });
  }, [area?.latitude, area?.longitude, area?.raioM]); // eslint-disable-line react-hooks/exhaustive-deps

  // ponto escolhido (alfinete arrastável)
  useEffect(() => {
    const mapa = mapaRef.current;
    camadas.current.ponto?.remove();
    if (!mapa || !ponto) return;
    const alfinete = L.divIcon({ className: 'mapa-alfinete', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 26] });
    camadas.current.ponto = L.marker([ponto.latitude, ponto.longitude], { icon: alfinete, draggable: Boolean(onEscolherPonto), title: 'Ponto escolhido' })
      .on('dragend', (e) => {
        const p = e.target.getLatLng();
        aoEscolher.current?.({ latitude: Number(p.lat.toFixed(7)), longitude: Number(p.lng.toFixed(7)) });
      })
      .addTo(mapa);
    if (!mapa.getBounds().contains([ponto.latitude, ponto.longitude])) mapa.setView([ponto.latitude, ponto.longitude], 16);
  }, [ponto?.latitude, ponto?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={caixaRef} className="mapa" style={{ height: altura }} role="region" aria-label={rotulo} />;
}
