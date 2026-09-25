// Edirne Olgunlaşma Enstitüsü Sanal Müzesi — site ayarları.
// Sergi, masaüstü uygulamasındaki Sanal Müze ekranında "Yayında" olan eserlerden
// her açılışta canlı kurulur; eser eklemek/çıkarmak için bu dosyaya dokunulmaz.
window.EOM_MUZE = {
  // Ana envanter e-tablosunun Apps Script dağıtım adresi (uygulamadaki "sheetUrl").
  apiAdresi: 'https://script.google.com/macros/s/AKfycbyBzhoIl714t9u_gJVXn0hjrLfR1gogihwkQ72-QLke7Zm3ach0_sTpGxvlwYpgWjFPqQ/exec',

  // Masaüstü uygulaması → Sanal Müze → Yayın & API → Yeni Anahtar.
  // Bu sayfa herkese açık olduğu için anahtar da görünür: yalnızca bu site için
  // ayrı bir anahtar üretin. Sızarsa uygulamadan silip yenisini buraya yazmanız yeter;
  // anahtar salt-okunurdur ve yalnızca zaten yayında olan eserleri döndürür.
  apiAnahtari: '',

  // Sergi metinlerinin dili: tr, en, de, bg, ar. Adres çubuğunda ?dil=en ile değişir.
  // Bir eserin o dilde metni yoksa Türkçesi gösterilir.
  dil: 'tr',

  // Salon görünümü: classic, dark veya modern.
  stil: 'classic'
};
