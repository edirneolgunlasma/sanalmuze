(async function() {
  const API_URL = "https://script.google.com/macros/s/AKfycbyBzhoIl714t9u_gJVXn0hjrLfR1gogihwkQ72-QLke7Zm3ach0_sTpGxvlwYpgWjFPqQ/exec?v=1&kaynak=manifest&key=eom_ab3a4ae28c894542be10b9a55b8c2ac11033165f3c3a4876";
 try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (data.success && data.veri && data.veri.length > 0) {
      window.config_file_content = {
        "root": { 
          "BJS_default_floor": { "resource": "floor.jpg", "resource_type": "material", "scale": [10, 10] },
          "BJS_default_wall": { "resource": "wall.jpg", "resource_type": "material", "scale": [5, 5] },
          "spawn_point": { "position": [0, 1.7, 0], "rotation": [0, 0, 0] }
        }
      };
      data.veri.forEach((eser, i) => {
        if (eser.gorseller && eser.gorseller.length > 0) {
          window.config_file_content["root"]["w_" + (i + 1)] = {
            "resource": eser.gorseller[0].buyuk,
            "resource_type": "image",
            "title": eser.kunye.eserAdi || "Isimsiz Eser",
            "description": (eser.icerik && eser.icerik.tr) ? eser.icerik.tr.hikaye : "",
            "artist": eser.kunye.uretici || "Edirne Olgunlasma Enstitusu",
            "scale": [1, 1, 1] 
          };
        }
      });
    }
  } catch (error) {
    console.error("API Hatasi:", error);
  }
})();


  