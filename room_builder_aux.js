async function  doDownload(filename, scene) {
	console.log('start download  ' + filename);
	
	await BABYLON.GLTF2Export.GLBAsync(scene, filename).then((glb) => {
	  glb.downloadFiles();
	  console.log('end download  ' + filename);
	});

}


var text3D_builder=function(name, item_position, vector, parent, scene){
	const north_vector=new BABYLON.Vector3(0, 0, 1);
	maxLength=1.3;
	
	texto=name.replace(/d_(.+)_\d+/, "$1");
	// Giriş salonları: "root" → "Ana Salon", zincirlenen "root 1" → "Ana Salon 2"
	texto=texto.replace(/^root(?:[ #](\d+))?$/, function(m, n){ return n ? "Ana Salon " + (Number(n) + 1) : "Ana Salon"; });
	// 3B yazı tipinde ş, ğ, İ gibi harflerin glifi yok; eksik harf temel harfine düşer (ş→s)
	texto=Array.from(texto).map(function(ch){
		if (!fontContent || !fontContent.glyphs || fontContent.glyphs[ch]) return ch;
		var temel=ch.normalize("NFD").charAt(0);
		return fontContent.glyphs[temel] ? temel : ch;
	}).join("");

	myText = BABYLON.MeshBuilder.CreateText("T_" + texto, texto, fontContent, {
		size: 0.2,
		resolution: 5, 
		depth: 0.1,
		sideOrientation:2 }, scene);

	//scale it
	scene.executeWhenReady(function () {
		// Assuming the text is aligned along the X axis, measure its length
		myText.refreshBoundingInfo();
		var boundingInfo = myText.getBoundingInfo();
		var textWidth = boundingInfo.maximum.x - boundingInfo.minimum.x;

		// Check if the text exceeds the maximum length
		if (textWidth > maxLength) {
			// Calculate the required scaling factor
			var scaleFactor = maxLength / textWidth;

			// Apply the scaling factor to the text mesh
			myText.scaling.x = scaleFactor;
			myText.scaling.y = scaleFactor; // Optional: Scale uniformly in Y to maintain aspect ratio
			// Note: Adjust Z scaling as needed, or leave it if uniform scaling is desired
		}
	});
	
	//place it
	myText.parent=parent;
	myText.position=new BABYLON.Vector3(item_position.x, item_position.y, item_position.z);
	
	//rotate
	var crossProduct = BABYLON.Vector3.Cross(north_vector, vector);
	// Calculate the dot product and use it to find the angle between vectors
    let dotProduct = BABYLON.Vector3.Dot(north_vector, vector);
    let angle = Math.acos(dotProduct);
	
	// Adjust the angle based on the direction of the cross product
    if (crossProduct.y < 0) {
        angle = -angle;
    }
	//let angle=Math.acos(BABYLON.Vector3.Dot(north_vector, vector)) * Math.sign(crossProduct.y);
		
	myText.rotate(BABYLON.Axis.Y, angle  , BABYLON.Space.LOCAL);
	
	//assign material
	myText.material = BJS_materials["BJS_black_metal"];
		

}

// Uzun eser adını en çok iki satıra böler; sığmayan kısım "…" ile kısalır.
function plaqueSatirlari(ctx, metin, maxPx, maxSatir) {
	var kelimeler = String(metin).split(/\s+/).filter(Boolean);
	var satirlar = [];
	var satir = '';
	for (var i = 0; i < kelimeler.length; i++) {
		var aday = satir ? satir + ' ' + kelimeler[i] : kelimeler[i];
		if (ctx.measureText(aday).width <= maxPx || !satir) { satir = aday; continue; }
		satirlar.push(satir);
		satir = kelimeler[i];
		if (satirlar.length === maxSatir - 1) { satir = kelimeler.slice(i).join(' '); break; }
	}
	if (satir) satirlar.push(satir);
	var son = satirlar.length - 1;
	if (ctx.measureText(satirlar[son]).width > maxPx) {
		var kisa = satirlar[son];
		while (kisa.length > 1 && ctx.measureText(kisa + '…').width > maxPx) kisa = kisa.slice(0, -1);
		satirlar[son] = kisa.replace(/\s+$/, '') + '…';
	}
	return satirlar;
}

// Etiketin üstündeki küçük lale (giriş kartındaki bölücüyle aynı çizim; viewBox -16 -14 32 30)
var PLAQUE_LALE = 'M0-13C4.5-8.5 5.2-2.5 0 4C-5.2-2.5-4.5-8.5 0-13Z' +
	'M0 4C-8 2.5-11-5-8-11.5C-6.2-5.5-3.6-1.4 0 4Z M0 4C8 2.5 11-5 8-11.5C6.2-5.5 3.6-1.4 0 4Z' +
	'M-0.6 3.5h1.2v11h-1.2Z M0 12C-3 8-7 7.5-10 8.5C-7 10.5-3.5 11.5 0 12Z M0 10C3 6.5 7 6 10 7C7 9 3.5 10 0 10Z';

var plaque_builder = function(name, item_position, item_size, vector, metadata, scene) {
	// Müze etiketi: fildişi zemin, ince altın çift çerçeve, üstte küçük altın lale, koyu
	// kahve serif eser adı (giriş kartıyla aynı dil). Yazı tipi (Cormorant Garamond) entegre.js'te
	// sergi kurulurken önceden indirilir; inmediyse Georgia'ya düşer.
	// metadata biçimi: "ID #N Başlık\nAlt satır" — ID öneki gösterilmez, alt satır isteğe bağlı.
	var plaqueText = metadata.replace(/^ID\s*#\d+\s*/, '');
	if (!plaqueText.trim()) return;
	var lines = plaqueText.split('\n');
	var titleText = (lines[0] || '').trim();
	var subtitleText = (lines[1] || '').trim().toLocaleUpperCase('tr');

	// Doku çözünürlüğü (piksel/metre). Dokunmatik cihazda bellek için daha düşük.
	var PX_M = (typeof isTouchDevice !== 'undefined' && isTouchDevice) ? 480 : 900;
	var px = function(m) { return m * PX_M; };
	var padX = 0.1, padTop = 0.052, padBottom = 0.06, lineH = 0.098;  // metre
	var ornH = 0.036, ornGap = 0.014;                                    // lale ve altındaki boşluk
	var minW = 0.72, maxW = Math.max(0.9, Math.min(item_size.width * 0.95, 1.6));
	var titleFont = '600 ' + Math.round(px(0.088)) + 'px "Cormorant Garamond", Georgia, "Times New Roman", serif';
	var subFont = '600 ' + Math.round(px(0.028)) + 'px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

	var olcum = plaque_builder._olcum || (plaque_builder._olcum = document.createElement('canvas').getContext('2d'));
	olcum.font = titleFont;
	var satirlar = plaqueSatirlari(olcum, titleText, px(maxW - 2 * padX), 2);
	var metinPx = 0;
	for (var i = 0; i < satirlar.length; i++) metinPx = Math.max(metinPx, olcum.measureText(satirlar[i]).width);
	if (subtitleText) {
		olcum.font = subFont;
		metinPx = Math.max(metinPx, Math.min(olcum.measureText(subtitleText).width, px(maxW - 2 * padX)));
	}

	var plaqueW = Math.min(maxW, Math.max(minW, metinPx / PX_M + 2 * padX));
	var plaqueH = padTop + ornH + ornGap + satirlar.length * lineH + (subtitleText ? lineH * 0.6 : 0) + padBottom;
	var texW = Math.round(px(plaqueW));
	var texH = Math.round(px(plaqueH));

	// Mipmap: uzaktan bakınca yazı titremesin (NPOT doku WebGL2 ister)
	var mip = scene.getEngine().webGLVersion > 1;
	var dynTex = new BABYLON.DynamicTexture("plaqueTex_" + name, {width: texW, height: texH}, scene, mip);
	dynTex.anisotropicFilteringLevel = 8;
	var ctx = dynTex.getContext();

	// Zemin: sıcak fildişi, aşağı doğru hafif koyulaşır; alt kenardaki ince gölge levhaya kalınlık verir
	var zemin = ctx.createLinearGradient(0, 0, 0, texH);
	zemin.addColorStop(0, '#faf6ee');
	zemin.addColorStop(1, '#eee6d6');
	ctx.fillStyle = zemin;
	ctx.fillRect(0, 0, texW, texH);
	ctx.fillStyle = 'rgba(90, 70, 40, 0.18)';
	ctx.fillRect(0, texH - Math.max(1, Math.round(px(0.004))), texW, Math.max(1, Math.round(px(0.004))));

	// Dış altın çizgi, içte soluk ikinci çizgi (Edirnekâri pano çerçevesi)
	var dis = Math.max(1, Math.round(px(0.005)));
	ctx.strokeStyle = '#b8924c';
	ctx.lineWidth = dis;
	ctx.strokeRect(dis / 2, dis / 2, texW - dis, texH - dis);
	var ic = px(0.017), ince = Math.max(1, Math.round(px(0.0018)));
	ctx.strokeStyle = 'rgba(184, 146, 76, 0.5)';
	ctx.lineWidth = ince;
	ctx.strokeRect(ic, ic, texW - 2 * ic, texH - 2 * ic);

	// Lale ve iki yanında kısa altın çizgiler
	var ornY = px(padTop + ornH / 2);
	var olcek = px(ornH) / 30;
	ctx.save();
	ctx.translate(texW / 2, ornY - olcek);
	ctx.scale(olcek, olcek);
	ctx.fillStyle = '#b08a45';
	ctx.fill(new Path2D(PLAQUE_LALE));
	ctx.restore();
	var kol = px(0.075), bosluk = px(0.03);
	ctx.strokeStyle = 'rgba(176, 138, 69, 0.85)';
	ctx.lineWidth = ince;
	ctx.beginPath();
	ctx.moveTo(texW / 2 - bosluk - kol, ornY); ctx.lineTo(texW / 2 - bosluk, ornY);
	ctx.moveTo(texW / 2 + bosluk, ornY); ctx.lineTo(texW / 2 + bosluk + kol, ornY);
	ctx.stroke();

	// Eser adı: koyu kahve, ortalı
	ctx.fillStyle = '#2a2119';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = titleFont;
	var y = px(padTop + ornH + ornGap + lineH / 2);
	for (var j = 0; j < satirlar.length; j++) {
		ctx.fillText(satirlar[j], texW / 2, y, texW - px(2 * padX));
		y += px(lineH);
	}
	if (subtitleText) {
		ctx.font = subFont;
		ctx.fillStyle = '#8a6a33';
		if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(px(0.004)) + 'px';
		ctx.fillText(subtitleText, texW / 2, y - px(lineH * 0.25), texW - px(2 * padX));
	}
	dynTex.update();

	var plaqueMat = new BABYLON.StandardMaterial("plaqueMat_" + name, scene);
	plaqueMat.diffuseTexture = dynTex;
	plaqueMat.emissiveTexture = dynTex;
	plaqueMat.specularColor = new BABYLON.Color3(0, 0, 0);
	plaqueMat.disableLighting = true;

	var base_vector = new BABYLON.Vector3(0, 0, 0);
	var abstractPlane = BABYLON.Plane.FromPositionAndNormal(base_vector, vector);

	var plaquePlane = BABYLON.MeshBuilder.CreatePlane("lbl_plaque_" + name, {
		sourcePlane: abstractPlane,
		width: plaqueW,
		height: plaqueH,
		sideOrientation: BABYLON.Mesh.SINGLESIDE
	}, scene);

	// Position: centered below frame
	var plaqueOffsetDown = (item_size.height / 2 + margin / 2 + plaqueH / 2 + 0.05);

	// Duvardan 2 cm önde: yandan bakınca havada durmasın, duvarla da çakışmasın
	plaquePlane.position = new BABYLON.Vector3(item_position.x, item_position.y, item_position.z)
		.add(vector.scale(0.02))
		.subtract(new BABYLON.Vector3(0, plaqueOffsetDown, 0));

	plaquePlane.material = plaqueMat;
	plaquePlane.isPickable = false;

	// Each plaque keeps its own DynamicTexture, so merging them into one mesh saves
	// no draw calls (a MultiMaterial still draws one submesh per texture) — it only
	// risked cross-wiring the textures. Keep plaques as individual meshes (like the
	// artwork image planes) and parent them to a single node so visibility toggles
	// with one setEnabled() call.
	var plaquesRoot = scene.getTransformNodeByName('plaques_root');
	if (!plaquesRoot) plaquesRoot = new BABYLON.TransformNode('plaques_root', scene);
	plaquePlane.parent = plaquesRoot;
}

var item_builder= function(name, item_position, item_size, vector, material,scene, item_shadow_material=null, frame_margin=margin){
	//places artwork as an image texture
	//adds a frame and both elements have a customizable separation from the wall
	//the thickness of the frame is half the separation
	
	const shadow_scale=1.3;
	var base_vector=new BABYLON.Vector3(0, 0, 0);
	const north_vector=new BABYLON.Vector3(0, 0, 1);
	var abstractPlane = BABYLON.Plane.FromPositionAndNormal(base_vector,vector );
	var item = BABYLON.MeshBuilder.CreatePlane(name, {sourcePlane: abstractPlane, width:item_size.width, height: item_size.height, sideOrientation: BABYLON.Mesh.SINGLESIDE},scene);

	//create the item shadow
	if (item_shadow_material!=null) {
		var item_shadow = BABYLON.MeshBuilder.CreatePlane("shadow", {sourcePlane: abstractPlane, width:item_size.width*shadow_scale, height: item_size.height*shadow_scale, sideOrientation: BABYLON.Mesh.SINGLESIDE},scene);
		item_shadow.position=new BABYLON.Vector3(item_position.x, item_position.y, item_position.z).add(vector.scale(0.01));
		item_shadow.material=item_shadow_material;
		
		let existing_shadow_object=scene.getMeshByName('shadows');
		if (existing_shadow_object){
			var merged_mesh = BABYLON.Mesh.MergeMeshes([existing_shadow_object, item_shadow], true);
			merged_mesh.name="shadows";
		} else {
			item_shadow.name="shadows";
		}

	}
	
	
	//the position is shifted away from the wall in the direction of the item vector (normal)
	item.position=new BABYLON.Vector3(item_position.x, item_position.y, item_position.z).add(vector.scale(3*item_separation/2));
	item.checkCollisions= true;
	if (material!=  undefined){
		item.material=material;
		item.material.specularColor=new BABYLON.Color3(0,0,0);

	}



	// Create the box at the position of the base vector with the plane's rotation
	let item2 = BABYLON.MeshBuilder.CreateBox("box" +name, {
		size: 1, 
		updatable: true
	}, scene);

	// Set the position, rotation and scale of the box/frame
	item2.position = new BABYLON.Vector3(item_position.x, item_position.y, item_position.z).add(vector.scale(item_separation/2-0.001));
	// Full-circle yaw so frames orient correctly on walls at any angle, not only N/S/E/W.
	item2.rotate(BABYLON.Axis.Y, Math.atan2(vector.x, vector.z), BABYLON.Space.LOCAL);
	item2.scaling = new BABYLON.Vector3(item_size.width+frame_margin, item_size.height+frame_margin, item_separation);
	
	
	//check if the mesh that merges all the frames is already created
	let existing_frame_object=scene.getMeshByName('frames');
	if (existing_frame_object){
		var merged_mesh = BABYLON.Mesh.MergeMeshes([existing_frame_object, item2], true);
		merged_mesh.name="frames";
	} else {
		item2.name="frames";
	}





	return item
}

// Builds an artwork's diffuse texture and reports when it is ready.
//
// Artwork textures are the largest memory cost in a big gallery: each arrives at
// 1024 px on the long edge and costs ~5.6 MB of VRAM, so 88 pieces is ~310 MB -
// past the per-tab ceiling on iOS. On touch devices we draw the image into a
// smaller DynamicTexture as it lands, so the full-size bitmap never reaches the
// GPU. That makes the texture asynchronous, hence onLoaded instead of the caller
// hooking onLoadObservable itself.
var artwork_texture = function(url, material, scene, onLoaded){
	// The material is frozen before it has a texture, so re-point it and refreeze.
	var apply = function(tex){
		material.unfreeze();
		material.diffuseTexture = tex;
		material.freeze();
	};

	var cap = (typeof isTouchDevice !== 'undefined' && isTouchDevice
		&& typeof max_artwork_px !== 'undefined') ? max_artwork_px : 0;

	// Bir görsel yüklenemezse (paylaşıma açılmamış Drive dosyası, geçici 429) ya da
	// hiç yanıt gelmezse de "bitti" sayılır; yoksa salonun yükleme ekranı hiç kapanmaz.
	var bitti = false;
	var bitir = function(){ if (!bitti) { bitti = true; onLoaded(); } };
	setTimeout(bitir, 30000);

	if (!cap){
		// undefined geçilen bağımsız değişkenler Babylon varsayılanlarını korur
		var full = new BABYLON.Texture(url, scene, undefined, undefined, undefined, null, bitir);
		apply(full);
		full.onLoadObservable.add(bitir);
		return;
	}

	var img = new Image();
	// The asset host sends Access-Control-Allow-Origin, so this keeps the
	// DynamicTexture's canvas untainted and therefore uploadable to WebGL.
	img.crossOrigin = "anonymous";
	// Count a failed image as done, or one bad URL leaves the loading bar short.
	img.onerror = bitir;
	img.onload = function(){
		var scale = Math.min(1, cap / Math.max(img.width, img.height));
		var w = Math.max(1, Math.round(img.width * scale));
		var h = Math.max(1, Math.round(img.height * scale));
		var tex = new BABYLON.DynamicTexture(url, {width: w, height: h}, scene, true);
		tex.getContext().drawImage(img, 0, 0, w, h);
		tex.update();
		apply(tex);
		bitir();
	};
	img.src = url;
};

function populate_template(config_file, room_name,scene){

    var _pt = document.getElementById('plaquesToggle');
    var showPlaques = _pt ? _pt.checked : (config_file["Technical"]["show_plaques"] === true);
    // show_frames off collapses the frame margin, leaving a mount the exact size of the artwork
    var frame_margin = config_file["Technical"]["show_frames"] === false ? 0 : margin;
    // width/height in the JSON are real cm. Babylon scene units don't read 1:1 to
    // real-world — a longest-edge of 2.5 babylon m reads as ~120 cm to the viewer.
    const SCENE_M_PER_CM = 2.5 / 120;
	
	const vector_n=new BABYLON.Vector3(0, 0, 1);
	const vector_s=new BABYLON.Vector3(0, 0, -1);
	const vector_e=new BABYLON.Vector3(1, 0, 0);
	const vector_w=new BABYLON.Vector3(-1, 0, 0);
	
	//position the items
	// get all the non image items
	var gallery=config_file[room_name];
	var dict_items=Object.keys(gallery).filter(key => gallery[key]["resource_type"]== "image");
	num_items=dict_items.length;

	//get frame shadow material
	var shadow_texture = new BABYLON.Texture(materials_folder +"/shadow.png", scene, false, BABYLON.Texture.LINEAR_LINEAR);
	shadow_texture.hasAlpha=true;
	
	var item_shadow_material = new BABYLON.StandardMaterial("shadow_mat", scene);
	item_shadow_material.specularColor=new BABYLON.Color3(0,0,0);
	item_shadow_material.diffuseTexture = shadow_texture;
	item_shadow_material.useAlphaFromDiffuseTexture = true;
	
	let i=3
	for (var item of dict_items){
		//get location
		let location=JSON.parse(gallery[item]["location"]);

		//get material
		let items_material=new BABYLON.StandardMaterial("item_mat_"+ item);
		items_material.freeze();
		items_material.specularColor=new BABYLON.Color3(0,0,0);
		items_material.maxSimultaneousLights=max_lights;
		//texture + loading-bar tick, assigned to the material by artwork_texture
		artwork_texture(window.resolveImageUrl(gallery[item]["resource"]), items_material, scene, ((j) => {
			return() => {
				percentage_artwork=percentage_artwork + j;
				if (Math.round(percentage_artwork) >= 100){
					markArtworksDone();
				}
			};
		})(100/num_items));
		items_material.emissiveColor=new BABYLON.Color3(1, 1, 1);
		items_material.disableLighting=true;

		//get orientation
		let orientation=JSON.parse(gallery[item]["vector"])
		orientation=new BABYLON.Vector3(orientation[0], 0, orientation[1])

		//width/height are real cm; convert to babylon scene meters
		scaled_width = Number(gallery[item]["width"]) * SCENE_M_PER_CM;
		scaled_height = Number(gallery[item]["height"]) * SCENE_M_PER_CM;

		//notice that y and z are flippped
		let artwork_plane = item_builder(item + "_" + i ,{x:location[0], y:location[2], z:location[1]}, {width:scaled_width, height:scaled_height}, orientation, items_material, scene, null, frame_margin);

		// Tag the plane with its position among the gallery's image items. The viewer
		// uses this to drive click→navigate, so the index can never drift even when the
		// template GLB contains decorative meshes whose names also end in _<digits>
		// (Fixture_0, Col_*_1, …). i starts at 3, so i-3 is the 0-based dict_items index.
		if (artwork_plane) artwork_plane.metadata = { ovgal_artwork_idx: i - 3 };

		//plaque below artwork (only if metadata has content beyond the ID prefix)
		if (gallery[item]["metadata"]) {
			plaque_builder(item + "_" + i, {x:location[0], y:location[2], z:location[1]}, {width:scaled_width, height:scaled_height}, orientation, gallery[item]["metadata"], scene);
		}

		//update loading bar in sync loop so browser can paint
		const round_per=Math.round(((i - 2) / num_items) * 100);
		document.getElementById("percentLoaded_artwork").textContent = `${round_per}%`;
		document.getElementById("loadingBar_artwork").style.width =`${round_per}%`;


		i=i+1;
	}
	
	if (dict_items.length>0)	{
		scene.getMeshByName("frames").createNormals(true);
		scene.getMeshByName("frames").material=BJS_materials[frame_material];
		scene.getMeshByName("frames").alwaysSelectAsActiveMesh=true;
		let shadowMesh=scene.getMeshByName("shadows");
		if (shadowMesh) shadowMesh.alwaysSelectAsActiveMesh=true;
	} else {
		markArtworksDone();
	}

	// Set plaque visibility from toggle state (one node parents every plaque)
	var plaquesRoot = scene.getTransformNodeByName("plaques_root");
	if (plaquesRoot) plaquesRoot.setEnabled(showPlaques);
	

	
	//locate doors in the json file
	var renamed_doors=0;
	var placed_doors=0;
	dict_items=Object.keys(gallery).filter(key => gallery[key]["resource_type"]== "door");
	max_doors=dict_items.length;

	// Sanal müze: giriş salonunda kapılar ilk nişlere yığılmaz, salona eşit aralıkla
	// dağılır (entegre.js eomKapiYuvalari; vitrin boş nişleri aynı işlevle bulur).
	// Yuva → kapı sırası; yuvası olmayan niş boş kalır.
	var door_slots = scene.meshes.filter((mesh) => regul_exp_door.test(mesh.name)).length;
	var slot_door = {};
	var slots = (/^root(#\d+)?$/.test(room_name) && typeof window.eomKapiYuvalari === 'function')
		? window.eomKapiYuvalari(max_doors, door_slots)
		: dict_items.map((_, i) => i);
	slots.forEach((slot, i) => { slot_door[slot] = i; });

	//go through the mesh check for doors and replace materials
	scene.meshes.map((mesh) => {

		if ((mesh.material != null) && mesh.material.name.startsWith("BJS_")){
			console.log("updating material " + mesh.material.name);
			let temp_name=mesh.material.name;
			mesh.material=BJS_materials[temp_name];
			mesh.alwaysSelectAsActiveMesh=true;
		}

		if (regul_exp_door.test(mesh.name)){
			var door_idx = slot_door[renamed_doors];
			if (door_idx === undefined){ //delete the door from the mesh
				mesh.name="dummydoor" + renamed_doors;

			} else {
				mesh.name="d_" + dict_items[door_idx] + "_" + renamed_doors;
				normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
				normal = new BABYLON.Vector3(normals[0], normals[1], normals[2]);

				//put text
				text3D_builder(dict_items[door_idx].replace("#", " "), mesh.position, normal, mesh.parent, scene);
				placed_doors++;
			}
			renamed_doors++;
		}
	});

	if (placed_doors < max_doors){
		console.log("ERROR: Some doors in the json are not present in the template");
	}

		

	
	//remove replaced materials
	scene.materials.forEach(material => {
		if (material.name.startsWith('BJS_'))
			material.dispose(); 
		
	});
	

}	


function reset_loadbar(){
	percentage_materials=0;
	percentage_template=0;
	percentage_artwork=0;
	document.getElementById("loader").style.display = "none";
	document.getElementById("loader").id= "loaded";
	document.getElementById("percentLoaded_template").textContent = `${percentage_template}%`;
	document.getElementById("loadingBar_template").style.width =`${percentage_template}%`;
	document.getElementById("percentLoaded_materials").textContent = `${percentage_materials}%`;
	document.getElementById("loadingBar_materials").style.width =`${percentage_materials}%`;
	document.getElementById("percentLoaded_artwork").textContent = `${percentage_artwork}%`;
	document.getElementById("loadingBar_artwork").style.width =`${percentage_artwork}%`;
	setLightsProgress(0);
}

// Load-phase coordinator for template galleries. Artworks and the lightmap bake
// finish asynchronously and independently, so the loader must stay up until BOTH
// are done — otherwise the "Setting up lights" bar is hidden before (or without)
// the bake completing. Non-template paths never call beginTemplateLoad, so
// markArtworksDone falls back to hiding the loader immediately, as before.
var _loadPhase = { artworks: false, lights: false, active: false };

function beginTemplateLoad(){
	_loadPhase = { artworks: false, lights: false, active: true };
	setLightsProgress(0);
}

function setLightsProgress(p){
	var bar = document.getElementById("loadingBar_lights");
	var txt = document.getElementById("percentLoaded_lights");
	if (bar) bar.style.width = `${p}%`;
	if (txt) txt.textContent = `${p}%`;
}

function markArtworksDone(){
	if (!_loadPhase.active){ reset_loadbar(); return; }
	_loadPhase.artworks = true;
	_maybeFinishLoad();
}

function markLightsDone(){
	setLightsProgress(100);
	_loadPhase.lights = true;
	_maybeFinishLoad();
}

function _maybeFinishLoad(){
	if (_loadPhase.active && _loadPhase.artworks && _loadPhase.lights){
		_loadPhase.active = false;
		reset_loadbar();
	}
}

