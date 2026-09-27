// Sanal müze ↔ envanter köprüsü.
//
// Masaüstü uygulamasında "Yayında" olan eserler Sanal Müze API'sinin manifest
// ucundan alınır, koleksiyonlarına göre gruplanır ve her koleksiyon bir salon olur
// (sığmayanlar "Selimiye Esintileri 2" diye devam eder). Salon sırası ve
// açıklaması uygulamadaki Koleksiyonlar sekmesinden gelir. Yerleşim, OpenVGAL
// üreticisinin duvar paketleyicisiyle (js/gallery-generator.js → packIntoRooms)
// tarayıcıda yapılır; building_v2.json dosyasına gerek kalmaz.
//
// Görüntüleyici (openvgal-viewer.js) window.eomSergiHazirla() tanımlıysa
// building_v2.json yerine onu bekler.
//
// Giriş salonu boş kalmaz: her koleksiyon kapısının iki yanında o koleksiyonun ilk
// iki eseri asılır, kullanılmayan kapı nişlerine de koleksiyonlardan birer eser konur.
(function () {
  'use strict';

  const AYAR = window.EOM_MUZE || {};
  const DILLER = ['tr', 'en', 'de', 'bg', 'ar'];
  const OLCU_ESZAMANLI = 8;        // aynı anda ölçülen küçük görsel
  const OLCU_ONBELLEK = 'eom-gorsel-olculeri-v1';
  const OLCU_ZAMAN_ASIMI = 15000;
  const API_ZAMAN_ASIMI = 60000;   // Apps Script soğuk açılışta 10+ sn sürebilir
  const SAHNE_M_CM = 2.5 / 120;    // room_builder_aux.js SCENE_M_PER_CM ile aynı

  // Giriş salonu şablonu (classic → T_root_B.glb) ölçüleri; tarayıcıda ışın atılarak
  // ölçüldü. Salon on yüzlüdür: k. yüzün ortasında d_k kapısı durur ve yüzün yönü
  // (Babylon XZ düzleminde) 144° + 36°·k'dir. Duvar yüzeyi merkezden 14.626 m, kapı
  // nişinin arka yüzü 14.382 m uzaktadır. Başka şablonda vitrin kurulmaz.
  const GIRIS_VITRINI = {
    sablon: 'T_root_B.glb',
    yuzSayisi: 10,
    ilkAci: 144,
    adim: 36,
    duvar: 14.626,
    nis: 14.382,
    // Kapının iki yanı: kapı ortasından ±3.1 m, göz hizası (granit çerçeve ±1.7 m'de biter)
    yan: { uzaklik: 3.1, yukseklik: 1.9, enFazlaGenislik: 1.7, enFazlaYukseklik: 1.7 },
    // Boş niş: 2.08 × 2.8 m'lik açıklığa çerçevesiyle sığar
    nisEseri: { yukseklik: 1.6, enFazlaGenislik: 1.3, enFazlaYukseklik: 1.6 }
  };

  // Giriş salonunda kapı, kapı nişi sayısından azsa kapılar salona eşit aralıkla
  // dağıtılır (5 koleksiyon → 0, 2, 4, 6, 8. nişler). room_builder_aux.js kapıları
  // bu sırayla yerleştirir; vitrin de aynı işlevle boş nişleri bulur.
  window.eomKapiYuvalari = function (kapiSayisi, yuvaSayisi) {
    if (kapiSayisi >= yuvaSayisi) return Array.from({ length: yuvaSayisi }, (_, i) => i);
    return Array.from({ length: kapiSayisi }, (_, i) => Math.floor(i * yuvaSayisi / kapiSayisi));
  };

  // Eser görselleri mutlak adres: declarations.js'in yerel öneki ('.' + adres) bozmasın.
  const yerelAdres = window.resolveImageUrl;
  window.resolveImageUrl = function (yol) {
    return /^https?:\/\//i.test(String(yol)) ? yol : yerelAdres(yol);
  };

  class MuzeHatasi extends Error {
    constructor(tur, ayrinti) {
      super(ayrinti || tur);
      this.tur = tur;
    }
  }

  function dilSec() {
    const istenen = new URLSearchParams(window.location.search).get('dil') || AYAR.dil || 'tr';
    const dil = String(istenen).toLowerCase();
    return DILLER.includes(dil) ? dil : 'tr';
  }

  // Büyük/küçük harf ve şapka farkı aynı salondur ("Edirnekari" = "Edirnekâri").
  function odaAnahtari(ad) {
    return String(ad || '').trim().toLocaleLowerCase('tr')
      .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u').replace(/\s+/g, ' ');
  }

  // Şapkalı yazım varsa o (doğru yazım), yoksa en sık kullanılan.
  function gorunenAd(yazimlar) {
    const sirali = [...yazimlar.entries()].sort((a, b) => b[1] - a[1]);
    const sapkali = sirali.find(([y]) => /[âîû]/i.test(y));
    return (sapkali || sirali[0])[0];
  }

  function durum(metin) {
    const el = document.getElementById('eom-yukleme-durum');
    if (el) el.textContent = metin;
  }

  async function manifestiGetir(dil) {
    if (!AYAR.apiAdresi || !AYAR.apiAnahtari) throw new MuzeHatasi('ayar');
    const adres = new URL(AYAR.apiAdresi);
    adres.search = new URLSearchParams({ v: '1', kaynak: 'manifest', dil: dil, key: AYAR.apiAnahtari }).toString();

    const iptal = new AbortController();
    const zamanlayici = setTimeout(() => iptal.abort(), API_ZAMAN_ASIMI);
    let yanit;
    try {
      yanit = await fetch(adres.toString(), { signal: iptal.signal });
    } catch (e) {
      throw new MuzeHatasi('ag', e.message);
    } finally {
      clearTimeout(zamanlayici);
    }

    let veri;
    try {
      veri = await yanit.json();
    } catch (e) {
      // Apps Script kota/iç hata durumunda JSON yerine HTML sayfası döner.
      throw new MuzeHatasi('sunucu', 'JSON olmayan yanıt (' + yanit.status + ')');
    }
    if (!veri || !veri.success) {
      const kod = veri && veri.kod;
      throw new MuzeHatasi(kod === 401 || kod === 403 ? 'anahtar' : (kod === 429 ? 'yogun' : 'sunucu'),
        (veri && veri.error) || 'Bilinmeyen hata');
    }
    return veri;
  }

  // Görselin en-boy oranı için 96 px'lik küçük hali yeterli; tam boy yalnızca
  // salona girilince doku olarak iner.
  function kucukAdres(g) {
    return g.kaynak === 'drive' && g.id ? 'https://lh3.googleusercontent.com/d/' + g.id + '=s96' : (g.kucuk || g.buyuk);
  }

  // Görüntüleyici dokuları 1024 px'e göre bütçeler (dokunmatikte 768'e iner).
  function dokuAdresi(g) {
    return g.kaynak === 'drive' && g.id ? 'https://lh3.googleusercontent.com/d/' + g.id + '=s1024' : (g.buyuk || g.tamBoy);
  }

  // Görsel oranları tarayıcıda saklanır: tekrar gelen ziyaretçi yüzlerce küçük
  // görseli yeniden indirmez. Anahtar görsel adresidir; görsel değişirse adres de değişir.
  let olcuOnbellegi = {};
  try { olcuOnbellegi = JSON.parse(localStorage.getItem(OLCU_ONBELLEK) || '{}') || {}; } catch (e) { olcuOnbellegi = {}; }
  function olcuOnbelleginiYaz() {
    try { localStorage.setItem(OLCU_ONBELLEK, JSON.stringify(olcuOnbellegi)); } catch (e) { /* özel pencere vb. */ }
  }

  function gorselOlcusu(eser) {
    const anahtar = kucukAdres(eser.gorseller[0]);
    const kayitli = olcuOnbellegi[anahtar];
    if (kayitli && kayitli.w > 0 && kayitli.h > 0) return Promise.resolve(kayitli);
    return olcuIndir(eser).then((o) => {
      if (!o.tahmini) olcuOnbellegi[anahtar] = { w: o.w, h: o.h };
      return o;
    });
  }

  function olcuIndir(eser) {
    return new Promise((coz) => {
      const img = new Image();
      let bitti = false;
      const bitir = (w, h) => {
        if (bitti) return;
        bitti = true;
        clearTimeout(zamanlayici);
        coz(w > 0 && h > 0 ? { w: w, h: h } : { w: 4, h: 3, tahmini: true });
      };
      const zamanlayici = setTimeout(() => bitir(0, 0), OLCU_ZAMAN_ASIMI);
      img.onload = () => bitir(img.naturalWidth, img.naturalHeight);
      img.onerror = () => bitir(0, 0);
      img.src = kucukAdres(eser.gorseller[0]);
    });
  }

  async function havuz(liste, eszamanli, is, ilerleme) {
    const sonuc = new Array(liste.length);
    let sira = 0, biten = 0;
    const isci = async () => {
      while (sira < liste.length) {
        const i = sira++;
        sonuc[i] = await is(liste[i]);
        biten++;
        if (ilerleme) ilerleme(biten, liste.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(eszamanli, liste.length) }, isci));
    return sonuc;
  }

  function eserBasligi(eser) {
    return String((eser.icerik && eser.icerik.baslik) || (eser.kunye && eser.kunye.eserAdi) || eser.envanterNo).trim();
  }

  // Duvardaki etiket yalnızca eserin adını taşır (plaque_builder).
  function etiket(eser) {
    return eserBasligi(eser).replace(/\s+/g, ' ');
  }

  // Giriş salonlarının ("root", "root#1") ve ayar bloğunun adıyla çakışmasın.
  function salonAdiGuvenli(ad) {
    return /^(root(#\d+)?|technical)$/i.test(ad) ? ad + ' Koleksiyonu' : ad;
  }

  // Görsel oranını koruyarak metre cinsinden kutuya sığdırır; ölçüyü cm döndürür.
  function kutuyaSigdir(o, enFazlaGenislik, enFazlaYukseklik) {
    const oran = o.w / o.h;
    let g = enFazlaGenislik;
    let y = g / oran;
    if (y > enFazlaYukseklik) { y = enFazlaYukseklik; g = y * oran; }
    return { wCm: g / SAHNE_M_CM, hCm: y / SAHNE_M_CM };
  }

  // Giriş salonu vitrini. Koleksiyon kapısının solunda koleksiyonun ilk, sağında ikinci
  // eseri durur (sunucu öne çıkanları başa dizer). Boş nişlere koleksiyonlardan sırayla,
  // henüz asılmamış birer eser konur. ◀ ▶ gezintisi ziyaretçinin ilk baktığı yüzden
  // (d_9) başlayıp salonu sağa doğru dolaşır.
  function girisVitriniKur(bina, odalar, olcu, eserAs) {
    const V = GIRIS_VITRINI;
    const kapilar = Object.keys(bina).filter((ad) => bina[ad].parent === 'root');
    const yuvalar = window.eomKapiYuvalari(kapilar.length, V.yuzSayisi);
    const yuzler = new Array(V.yuzSayisi).fill(null);   // yüz → koleksiyon, 'kapi' (Ana Salon 2) ya da boş
    kapilar.forEach((ad, i) => {
      if (yuvalar[i] !== undefined) yuzler[yuvalar[i]] = odalar.find((o) => o.ad === ad) || 'kapi';
    });

    const yerlesim = [];
    const asilan = new Set();
    yuzler.forEach((oda, yuz) => {
      if (!oda || oda === 'kapi') return;
      oda.eserler.slice(0, 2).forEach((e, j) => {
        asilan.add(e);
        yerlesim.push({ yuz: yuz, uzaklik: j === 0 ? -V.yan.uzaklik : V.yan.uzaklik, eser: e, nis: false });
      });
    });
    const kuyruklar = odalar.map((o) => o.eserler.filter((e) => !asilan.has(e)));
    let siradaki = 0;
    yuzler.forEach((oda, yuz) => {
      if (oda) return;
      for (let d = 0; d < kuyruklar.length; d++) {
        const k = (siradaki + d) % kuyruklar.length;
        if (!kuyruklar[k].length) continue;
        yerlesim.push({ yuz: yuz, uzaklik: 0, eser: kuyruklar[k].shift(), nis: true });
        siradaki = k + 1;
        return;
      }
    });

    // Yüz açısı azaldıkça ziyaretçinin sağına dönülür; yüz içinde soldan sağa.
    yerlesim.sort((a, b) => b.yuz - a.yuz || a.uzaklik - b.uzaklik);
    for (const y of yerlesim) {
      const aci = (V.ilkAci + V.adim * y.yuz) * Math.PI / 180;
      const merkez = y.nis ? V.nis : V.duvar;
      const normal = [-Math.cos(aci), -Math.sin(aci)];
      const boyunca = [-normal[1], normal[0]];      // duvara bakana göre sağ (placeItems ile aynı)
      const kutu = y.nis ? V.nisEseri : V.yan;
      eserAs('root', y.eser, kutuyaSigdir(olcu.get(y.eser), kutu.enFazlaGenislik, kutu.enFazlaYukseklik), [
        merkez * Math.cos(aci) + boyunca[0] * y.uzaklik,
        merkez * Math.sin(aci) + boyunca[1] * y.uzaklik,
        kutu.yukseklik
      ], normal);
    }
  }

  async function sergiyiKur() {
    const dil = dilSec();
    durum('Eserler enstitü envanterinden alınıyor…');
    const manifest = await manifestiGetir(dil);
    const eserler = (manifest.veri || []).filter((e) => e && e.envanterNo && e.gorseller && e.gorseller.length);
    if (!eserler.length) throw new MuzeHatasi('bos');

    // Koleksiyon sırası ve açıklaması manifestten (sunucu salon sırasına göre dizer)
    const tanim = new Map();
    ((manifest.kurum && manifest.kurum.koleksiyonlar) || []).forEach((k, i) => {
      const anahtar = odaAnahtari(k.ad);
      if (!tanim.has(anahtar)) tanim.set(anahtar, { sira: i, aciklama: String(k.aciklama || '').trim() });
    });
    const gruplar = new Map();
    eserler.forEach((e) => {
      const ad = String(e.koleksiyon || e.atolye || 'Genel Koleksiyon').trim();
      const anahtar = odaAnahtari(ad);
      if (!gruplar.has(anahtar)) gruplar.set(anahtar, { anahtar, yazimlar: new Map(), eserler: [] });
      const g = gruplar.get(anahtar);
      g.eserler.push(e);
      g.yazimlar.set(ad, (g.yazimlar.get(ad) || 0) + 1);
    });
    const odalar = [...gruplar.values()]
      .map((g) => {
        const t = tanim.get(g.anahtar) || { sira: 1e6, aciklama: '' };
        return { ad: salonAdiGuvenli(gorunenAd(g.yazimlar)), eserler: g.eserler, sira: t.sira, aciklama: t.aciklama };
      })
      .sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, 'tr'));

    const olculer = await havuz(eserler, OLCU_ESZAMANLI, gorselOlcusu, (n, t) =>
      durum(eserler.length + ' eser ' + odalar.length + ' koleksiyon salonuna yerleştiriliyor… (' + n + '/' + t + ')'));
    const olcu = new Map(eserler.map((e, i) => [e, olculer[i]]));
    olcuOnbelleginiYaz();

    const katalog = await loadCatalog(cdn_base);
    const stil = katalog.styles[AYAR.stil] ? AYAR.stil : Object.keys(katalog.styles)[0];
    const girisSablonu = katalog.styles[stil].root;
    const kapiSayisi = Math.max(3, katalog.styles[stil].rootDoors || DEFAULT_DOORS_ROOT);

    const bina = { root: { parent: 'none', resource: 'eom-giris.glb', template: girisSablonu } };

    // Giriş salonunun kapısı yetmezse ek giriş salonları zincirlenir
    // (gallery-generator.js buildGalleryJSON ile aynı kural).
    let ustSira = 0;
    function sonrakiGiris() {
      ustSira++;
      if (odalar.length <= kapiSayisi || ustSira <= kapiSayisi - 1) return 'root';
      const j = Math.ceil((ustSira - (kapiSayisi - 1)) / (kapiSayisi - 2));
      const ad = 'root#' + j;
      if (!bina[ad]) {
        bina[ad] = { parent: j === 1 ? 'root' : 'root#' + (j - 1), resource: 'eom-giris.glb', template: girisSablonu };
      }
      return ad;
    }

    const eserHaritasi = {};
    const salonlar = [];
    let sira = 0;
    // konum: [x, z, göz hizası y] duvar yüzeyinde; yon: duvarın salona bakan normali [x, z]
    function eserAs(salonAdi, e, cm, konum, yon) {
      bina[salonAdi][e.envanterNo] = {
        resource: dokuAdresi(e.gorseller[0]),
        resource_type: 'image',
        width: cm.wCm.toFixed(2),
        height: cm.hCm.toFixed(2),
        location: '[' + konum.map((x) => x.toFixed(3)).join(',') + ']',
        vector: '[' + yon[0].toFixed(4) + ',' + yon[1].toFixed(4) + ']',
        metadata: 'ID #' + (sira++) + ' ' + etiket(e)
      };
      (eserHaritasi[salonAdi] = eserHaritasi[salonAdi] || {})[e.envanterNo] = e;
    }

    for (const oda of odalar) {
      const ogeler = oda.eserler.map((e) => {
        const o = olcu.get(e);
        const cm = defaultCmDims(o.w, o.h);
        return { eser: e, cmWidth: cm.wCm, cmHeight: cm.hCm, widthM: cmToBabylon(cm.wCm) };
      });
      const yerlesim = await packIntoRooms(ogeler, katalog, stil, null, cdn_base, './');
      let ebeveyn = sonrakiGiris();
      yerlesim.forEach((salon, n) => {
        const ad = n === 0 ? oda.ad : oda.ad + ' ' + (n + 1);
        bina[ad] = { parent: ebeveyn, resource: 'eom-salon.glb', template: salon.glbName };
        salon.indices.forEach((indeks, k) => {
          const oge = ogeler[indeks];
          eserAs(ad, oge.eser, { wCm: oge.cmWidth, hCm: oge.cmHeight }, salon.positions[k], salon.vectors[k]);
        });
        salonlar.push({ ad: ad, koleksiyon: oda.ad, bolum: n + 1, sayi: salon.indices.length, aciklama: oda.aciklama });
        ebeveyn = ad;
      });
    }

    // Vitrin, hangi nişin kapı olacağını salonların giriş salonuna bağlanma sırasından
    // çıkarır; bu yüzden bütün salonlar bina'ya eklendikten sonra kurulur.
    if (girisSablonu === GIRIS_VITRINI.sablon) girisVitriniKur(bina, odalar, olcu, eserAs);

    for (const ad of Object.keys(bina)) {
      const ebeveyn = bina[ad].parent;
      if (ebeveyn && ebeveyn !== 'none') {
        bina[ebeveyn][ad] = { resource: ad + '.glb', resource_type: 'door' };
        bina[ad][ebeveyn] = { resource: ebeveyn + '.glb', resource_type: 'door' };
      }
    }

    bina.Technical = {
      ambientLight: 0.5, pointLight: 50, style: stil,
      show_plaques: true, show_frames: true, skip_hub: false
    };

    window.EOM_SERGI = {
      dil: dil,
      toplam: eserler.length,
      // kapak: giriş kartındaki koleksiyon kartının görseli (koleksiyonun ilk eseri)
      odalar: odalar.map((o) => {
        const g = o.eserler[0].gorseller[0];
        return { ad: o.ad, sayi: o.eserler.length, aciklama: o.aciklama, kapak: g.kucuk || g.buyuk || g.tamBoy };
      }),
      salonlar: salonlar,
      eserler: eserHaritasi,
      baslik: eserBasligi
    };
    document.dispatchEvent(new CustomEvent('eom:sergi-hazir', { detail: window.EOM_SERGI }));
    durum('Giriş salonu hazırlanıyor…');
    return bina;
  }

  const HATA_METINLERI = {
    ayar: ['Sanal müze henüz yapılandırılmadı',
      'site/muze-ayar.js dosyasına Sanal Müze API anahtarı girilmeli (masaüstü uygulaması → Sanal Müze → Yayın & API → Yeni Anahtar).'],
    anahtar: ['Sergiye erişilemedi',
      'API anahtarı geçersiz ya da devre dışı. Masaüstü uygulamasından bu site için yeni bir anahtar üretip site/muze-ayar.js dosyasına yazın.'],
    ag: ['Sergiye bağlanılamadı', 'İnternet bağlantınızı kontrol edip sayfayı yenileyin.'],
    yogun: ['Müze şu an çok yoğun', 'Birkaç dakika sonra sayfayı yenileyerek tekrar deneyin.'],
    sunucu: ['Sergi yüklenemedi', 'Müze sunucusu yanıt vermedi. Birkaç dakika sonra tekrar deneyin.'],
    bos: ['Sergi hazırlanıyor', 'Sanal müzede henüz yayında eser yok. Eserler masaüstü uygulamasındaki Sanal Müze ekranından yayına alındığında burada koleksiyonlarına göre sergilenir.']
  };

  function hatayiGoster(hata) {
    const tur = hata instanceof MuzeHatasi ? hata.tur : 'sunucu';
    const [baslik, aciklama] = HATA_METINLERI[tur] || HATA_METINLERI.sunucu;
    console.error('[sanal müze]', tur, hata && hata.message);
    const kutu = document.createElement('div');
    kutu.id = 'eom-hata';
    kutu.setAttribute('role', 'alert');
    const kart = document.createElement('div');
    kart.className = 'eom-hata-kart';
    const ust = document.createElement('p');
    ust.className = 'eom-ust-baslik';
    ust.textContent = 'Edirne Olgunlaşma Enstitüsü · Sanal Müze';
    const h = document.createElement('h1');
    h.textContent = baslik;
    const p = document.createElement('p');
    p.textContent = aciklama;
    kart.append(ust, h, p);
    if (tur !== 'ayar' && tur !== 'bos') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eom-dugme';
      btn.textContent = 'Tekrar dene';
      btn.addEventListener('click', () => window.location.reload());
      kart.append(btn);
    }
    kutu.append(kart);
    document.body.append(kutu);
    const yukleyici = document.getElementById('loader');
    if (yukleyici) yukleyici.style.display = 'none';
  }

  // Görüntüleyici yazı tipini indirirken sergi de paralel hazırlansın diye hemen başlar.
  const sergiSozu = sergiyiKur();
  sergiSozu.catch(hatayiGoster);
  window.eomSergiHazirla = () => sergiSozu;
})();
