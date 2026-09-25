// Sanal müze arayüzü: giriş kartı, salon rozeti, eser ayrıntı paneli ve büyük görsel.
// Eser verisi entegre.js'in kurduğu window.EOM_SERGI'den gelir; görüntüleyici esere
// tıklanınca window.eomEserAc(indeks), eserler arasında gezinirken eomEserGuncelle(indeks) çağırır.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let gorselSira = 0;
  let acikEser = null;
  let oncekiOdak = null;

  function sergi() { return window.EOM_SERGI || null; }

  function gecerliSalon() {
    return typeof current_gallery !== 'undefined' ? current_gallery : window.current_gallery;
  }

  function salonAdi(ad) {
    if (!ad || ad === 'root') return 'Ana Salon';
    const hub = /^root#(\d+)$/.exec(ad);
    if (hub) return 'Ana Salon ' + (Number(hub[1]) + 1);
    const salon = salonBilgisi(ad);
    if (!salon) return ad;
    return salon.koleksiyon + (salon.bolum > 1 ? ' · ' + salon.bolum + '. salon' : '');
  }

  function salonBilgisi(ad) {
    const s = sergi();
    return (s && s.salonlar.find((x) => x.ad === ad)) || null;
  }

  // Görüntüleyicinin eser sırası: salon nesnesindeki "image" anahtarlarının sırası
  // (overlay.js getArtworkPose ile aynı).
  function salondakiEser(indeks) {
    const s = sergi();
    const ad = gecerliSalon();
    if (!s || typeof config_file_content === 'undefined' || !config_file_content || !config_file_content[ad]) return null;
    const salon = config_file_content[ad];
    const anahtarlar = Object.keys(salon).filter((k) => salon[k] && salon[k].resource_type === 'image');
    if (!anahtarlar.length) return null;
    const i = ((indeks % anahtarlar.length) + anahtarlar.length) % anahtarlar.length;
    const eser = s.eserler[ad] && s.eserler[ad][anahtarlar[i]];
    return eser ? { eser: eser, indeks: i, toplam: anahtarlar.length } : null;
  }

  function el(etiket, sinif, metin) {
    const e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (metin !== undefined) e.textContent = metin;
    return e;
  }

  // --- Eser paneli ---
  function gorseliGoster() {
    const e = acikEser && acikEser.eser;
    if (!e) return;
    const g = e.gorseller[gorselSira] || e.gorseller[0];
    const img = $('eom-gorsel-img');
    const cerceve = img.closest('.eom-gorsel');
    cerceve.classList.remove('hatali');
    img.onerror = () => cerceve.classList.add('hatali');
    img.src = g.buyuk || g.tamBoy;
    img.alt = sergi().baslik(e);
    $('eom-kucukler').querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-current', i === gorselSira ? 'true' : 'false');
    });
  }

  // Bilgi kartı yalnızca eserin adını, ölçüsünü ve hikayesini gösterir.
  function paneliCiz(bulgu) {
    acikEser = bulgu;
    const e = bulgu.eser;
    const olculeri = String((e.kunye && e.kunye.olculeri) || '').trim();
    $('eom-eser-baslik').textContent = sergi().baslik(e);

    const olcu = $('eom-eser-olcu');
    olcu.textContent = olculeri ? 'Ölçü: ' + olculeri : '';
    olcu.hidden = !olculeri;

    const hikaye = $('eom-eser-hikaye');
    hikaye.replaceChildren(...String((e.icerik && e.icerik.hikaye) || '').split(/\n+/)
      .map((s) => s.trim()).filter(Boolean).map((s) => el('p', '', s)));

    const kucukler = $('eom-kucukler');
    kucukler.hidden = e.gorseller.length < 2;
    kucukler.replaceChildren(...(e.gorseller.length < 2 ? [] : e.gorseller.map((g, i) => {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('aria-label', (i + 1) + '. görsel');
      const img = el('img');
      img.src = g.kucuk || g.buyuk;
      img.alt = '';
      img.loading = 'lazy';
      b.append(img);
      b.addEventListener('click', () => { gorselSira = i; gorseliGoster(); });
      return b;
    })));

    gorselSira = 0;
    gorseliGoster();
    $('eom-sira').textContent = (bulgu.indeks + 1) + ' / ' + bulgu.toplam;
    $('eom-panel-kaydir').scrollTop = 0;
  }

  function panelAcik() { return $('eom-eser-panel').classList.contains('acik'); }

  function paneliAc() {
    const panel = $('eom-eser-panel');
    if (!panelAcik()) oncekiOdak = document.activeElement;
    panel.classList.add('acik');
    panel.setAttribute('aria-hidden', 'false');
    $('eom-panel-kapat').focus({ preventScroll: true });
  }

  function paneliKapat() {
    const panel = $('eom-eser-panel');
    if (!panelAcik()) return;
    panel.classList.remove('acik');
    panel.setAttribute('aria-hidden', 'true');
    acikEser = null;
    if (oncekiOdak && oncekiOdak.focus) oncekiOdak.focus({ preventScroll: true });
  }

  window.eomEserAc = function (indeks) {
    const bulgu = salondakiEser(indeks);
    if (!bulgu) return;
    paneliCiz(bulgu);
    paneliAc();
  };

  window.eomEserGuncelle = function (indeks) {
    if (!panelAcik()) return;
    const bulgu = salondakiEser(indeks);
    if (bulgu) paneliCiz(bulgu);
  };

  // --- Büyük görsel ---
  function buyukAc() {
    const e = acikEser && acikEser.eser;
    if (!e) return;
    const g = e.gorseller[gorselSira] || e.gorseller[0];
    const kutu = $('eom-buyuk');
    const img = kutu.querySelector('img');
    img.src = g.tamBoy || g.buyuk;
    img.alt = sergi().baslik(e);
    kutu.classList.remove('yakin');
    kutu.hidden = false;
    kutu.querySelector('.eom-kapat').focus({ preventScroll: true });
  }

  function buyukKapat() {
    const kutu = $('eom-buyuk');
    if (kutu.hidden) return false;
    kutu.hidden = true;
    kutu.querySelector('img').removeAttribute('src');
    $('eom-gorsel-buyut').focus({ preventScroll: true });
    return true;
  }

  // --- Giriş kartı ve salon rozeti ---
  function girisGoruldu(yaz) {
    try {
      if (yaz) sessionStorage.setItem('eom-giris-goruldu', '1');
      return sessionStorage.getItem('eom-giris-goruldu') === '1';
    } catch (e) {
      return false;
    }
  }

  function girisiAc() {
    $('eom-giris').hidden = false;
    $('eom-giris-kapat').focus({ preventScroll: true });
  }

  function girisiKapat() {
    if ($('eom-giris').hidden) return false;
    $('eom-giris').hidden = true;
    girisGoruldu(true);
    return true;
  }

  // İlk salon yüklenmeden kapıdan geçilemez; yükleyici gizlenince (#loader → #loaded) gidilir.
  function salonaGit(ad) {
    girisiKapat();
    const dene = () => {
      const hazir = !document.getElementById('loader') && typeof window.galleryManager === 'function';
      if (!hazir) { setTimeout(dene, 300); return; }
      if (gecerliSalon() === ad) return;
      if (typeof navigateToGallery === 'function') navigateToGallery(ad);
    };
    dene();
  }

  function sergiHazir(s) {
    $('eom-giris-sayi').textContent = s.toplam + ' eser · ' + s.odalar.length + ' koleksiyon';
    $('eom-atolyeler').replaceChildren(...s.odalar.map((o) => {
      const li = el('li');
      const b = el('button');
      b.type = 'button';
      b.append(document.createTextNode(o.ad), el('small', '', String(o.sayi)));
      b.addEventListener('click', () => salonaGit(o.ad));
      li.append(b);
      return li;
    }));
    const derinBaglanti = new URLSearchParams(window.location.search).get('gallery');
    if (!derinBaglanti && !girisGoruldu()) girisiAc();
    $('eom-oda-rozeti').hidden = false;
  }

  // Koleksiyon salonuna girilince adı ve açıklaması birkaç saniye görünür.
  let tanitimZamanlayici = null;
  function salonTanit(ad) {
    const kutu = $('eom-salon-tanitim');
    clearTimeout(tanitimZamanlayici);
    const salon = salonBilgisi(ad);
    if (!salon || !salon.aciklama) { kutu.hidden = true; return; }
    $('eom-salon-tanitim-ad').textContent = salonAdi(ad);
    $('eom-salon-tanitim-metin').textContent = salon.aciklama;
    kutu.hidden = false;
    tanitimZamanlayici = setTimeout(() => { kutu.hidden = true; }, 8000);
  }

  // Tanıtım, salon yüklenip yükleme ekranı (#loader) kapandıktan sonra gösterilir.
  let sonSalon = null;
  let bekleyenTanitim = null;
  function salonuIzle() {
    const ad = gecerliSalon();
    if (ad && ad !== sonSalon) {
      sonSalon = ad;
      paneliKapat();
      $('eom-salon-tanitim').hidden = true;
      const s = sergi();
      const sayi = s && s.eserler[ad] ? Object.keys(s.eserler[ad]).length : 0;
      $('eom-oda-adi').textContent = salonAdi(ad) + (sayi ? ' · ' + sayi + ' eser' : '');
      bekleyenTanitim = ad;
    }
    if (bekleyenTanitim && bekleyenTanitim === ad && !document.getElementById('loader')) {
      bekleyenTanitim = null;
      salonTanit(ad);
    }
  }

  function baslat() {
    $('eom-panel-kapat').addEventListener('click', paneliKapat);
    $('eom-gorsel-buyut').addEventListener('click', buyukAc);
    $('eom-onceki').addEventListener('click', () => { if (typeof manual_move_backward === 'function') manual_move_backward(); });
    $('eom-sonraki').addEventListener('click', () => { if (typeof manual_move_forward === 'function') manual_move_forward(); });
    $('eom-eser-panel').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); $('eom-onceki').click(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); $('eom-sonraki').click(); }
    });

    const buyuk = $('eom-buyuk');
    buyuk.addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG') buyuk.classList.toggle('yakin');
      else buyukKapat();
    });

    $('eom-giris-kapat').addEventListener('click', girisiKapat);
    $('eom-giris').addEventListener('click', (e) => { if (e.target.id === 'eom-giris') girisiKapat(); });
    $('eom-oda-rozeti').addEventListener('click', girisiAc);

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (buyukKapat() || girisiKapat()) return;
      paneliKapat();
    });

    if (sergi()) sergiHazir(sergi());
    else document.addEventListener('eom:sergi-hazir', (e) => sergiHazir(e.detail), { once: true });
    setInterval(salonuIzle, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();
})();
