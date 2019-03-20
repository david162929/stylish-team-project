app.state.product = null;
app.state.variant = null;
app.state.qty = 0;
app.init = function () {
	let id = app.getParameter("id");
	if (!id) {
		window.location = "./";
	}
	app.cart.init();
	app.getProduct(id);
	getVideos(id);
	// init event handlers
	app.setEventHandlers(app.get("#product-add-cart-btn"), {
		click: function () {
			app.cart.add(app.state.product, app.state.variant, app.state.qty);
		}
	});
};
app.getProduct = function (id) {
	app.ajax("get", app.cst.API_HOST + "/products/details", "id=" + id, {}, function (req) {
		let data = JSON.parse(req.responseText).data;
		let variant;
		// find first chosen variant available
		for (let key in data.variants) {
			variant = data.variants[key];
			if (variant.stock > 0) {
				app.state.variant = variant;
				break;
			}
		}
		app.state.product = data;
		app.state.qty = 1;
		// update menu item
		app.updateMenuItems(app.state.product.category);
		// show product
		app.showProduct();
	});
};
app.showProduct = function () {
	let product = app.state.product;
	app.get("#product-name").textContent = product.title;
	app.get("#product-id").textContent = product.id;
	app.get("#product-price").textContent = "TWD." + product.price;
	app.get("#product-summary").innerHTML = product.note + "<br/><br/>" + product.texture + "<br/>" + product.description.replace(/\r\n/g, "<br/>") + "<br/><br/>清洗：" + product.wash + "<br/>產地：" + product.place;
	app.createElement("img", {
		atrs: {
			src: product.main_image
		}
	}, app.get("#product-main-image"));
	// colors
	let colorContainer = app.get("#product-colors");
	for (let i = 0; i < product.colors.length; i++) {
		let color = product.colors[i];
		app.createElement("div", {
			atrs: {
				className: "color" + (app.state.variant.color_code === color.code ? " current" : ""),
				value: color
			},
			stys: {
				backgroundColor: "#" + color.code
			},
			evts: {
				click: app.evts.clickColor
			}
		}, colorContainer);
	}
	// sizes
	let sizeContainer = app.get("#product-sizes");
	product.sizes.forEach((size) => {
		let variant = app.findVariant(app.state.variant.color_code, size);
		let outStock = variant.stock === 0;
		app.createElement("div", {
			atrs: {
				className: "size" + (app.state.variant.size === size ? " current" : "") + (outStock ? " disabled" : ""),
				textContent: size,
				value: size
			},
			evts: {
				click: app.evts.clickSize
			}
		}, sizeContainer);
	});
	// qty
	app.get("#product-qty>.value").textContent = app.state.qty;
	let ops = app.getAll("#product-qty>.op");
	ops.forEach((op) => {
		op.addEventListener("click", app.evts.clickQty);
	});
	// story
	app.get("#product-story").innerHTML = product.story;
	// images
	for (let i = 0; i < 2 && i < product.images.length; i++) {
		app.createElement("img", {
			atrs: {
				src: product.images[i]
			}
		}, app.get("#product-images"));
	}
};
app.findVariant = function (colorCode, size) {
	let product = app.state.product;
	return product.variants.find((item) => {
		return item.color_code === colorCode && item.size === size
	});
};
app.refreshProductVariants = function () {
	let variant = app.state.variant;
	let colors = app.getAll("#product-colors>.color");
	for (let i = 0; i < colors.length; i++) {
		if (colors[i].value.code === variant.color_code) {
			colors[i].classList.add("current");
		} else {
			colors[i].classList.remove("current");
		}
	}
	let sizes = app.getAll("#product-sizes>.size");
	let outStock;
	for (let i = 0; i < sizes.length; i++) {
		// control current
		if (sizes[i].value === variant.size) {
			sizes[i].classList.add("current");
		} else {
			sizes[i].classList.remove("current");
		}
		outStock = app.findVariant(variant.color_code, sizes[i].value).stock === 0;
		// control disabled
		if (outStock) {
			sizes[i].classList.add("disabled");
		} else {
			sizes[i].classList.remove("disabled");
		}
	}
	app.get("#product-qty>.value").textContent = app.state.qty;
};
app.evts.clickColor = function (e) {
	let color = e.currentTarget.value;
	app.state.variant = app.findVariant(color.code, app.state.variant.size);
	if (app.state.variant.stock === 0) { // out of stock, choose another size automatically
		let sizes = app.state.product.sizes;
		let variant;
		for (let i = 0; i < sizes.length; i++) {
			variant = app.findVariant(color.code, sizes[i]);
			if (variant.stock > 0) {
				app.state.variant = variant;
				break;
			}
		}
	}
	app.state.qty = 1;
	app.refreshProductVariants();
};
app.evts.clickSize = function (e) {
	if (e.currentTarget.classList.contains("disabled")) {
		return;
	}
	let size = e.currentTarget.value;
	app.state.variant = app.findVariant(app.state.variant.color_code, size);
	app.state.qty = 1;
	app.refreshProductVariants();
};
app.evts.clickQty = function (e) {
	let value = parseInt(e.currentTarget.getAttribute("data-value"));
	let qty = app.state.qty;
	qty = qty + value;
	if (qty > 0 && qty <= app.state.variant.stock) {
		app.state.qty = qty;
		app.get("#product-qty>.value").textContent = app.state.qty;
	}
};



// 在 product 頁接 YouTube 影片
//id 是從 app init 傳進來的
function getVideos(id) {

	const getVideosURL = `https://davidadm.com/api/1.0/products/video-get?id=${id}`;

	fetch(getVideosURL, {
			method: 'GET', // *GET, POST, PUT, DELETE, etc.
		}).then(res => res.json())
		.then(function (data) {
			showVideos(data);
		});
};

//show videos
function showVideos(data) {
	console.log(data);
	for (let i = 0; i < data.data.length; i += 1) {
		let src = data.data[i];
		let frame = document.getElementById('product-videos');
		let video = document.createElement('div');
		frame.appendChild(video);
		video.innerHTML = `<iframe width="560" height="315" src=${src} frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
	}
}


function addVideo() {
	var button = document.getElementById('clickAdd');
	button.onclick = function (e) {
		var inputText = document.getElementById('addInput').value;
		const id = document.getElementById('product-id').innerText;
		const addVideosURL = `https://davidadm.com/api/1.0/products/video-add?id=${id}&link=${inputText}`;

		fetch(addVideosURL, {
				headers: {
					'Authorization': 'Bearer iamacoolguyilovetaiwan',
				},
				method: 'GET', // *GET, POST, PUT, DELETE, etc.
			}).then(res => res.json())
			.then(function (data) {
				showVideos(data);
			});
	};
}



// 寄信 push notification: 當我拿到後端打過來的信件通知時，我再 push 到 chrome 頁面上？


// list click
function Listlist() {
	var list = document.querySelector('.listlist');

	list.onclick = function () {
		window.location = "favorite.html";
	}
}

//like button
function likeButton() {
	console.log('likeButton')
	var like = document.querySelector('.like-btn');
	like.onclick = function (e) {
		const trigger = e.target.classList.toggle('is-active');
		const id = document.getElementById('product-id').innerText;
		const likeUrl = `https://davidadm.com/api/1.0/user/favorite-save?id=${id}`;
		const unlikeUrl = `https://davidadm.com/api/1.0/user/favorite-delete?id=${id}`;
		const token = getCookies('token');
		console.log(token);
		if (!token) {
			return;
		}
		if (trigger) { // like
			let header = new Headers({
				'Authorization': `Bearer ${token}`,
			})
			console.log(header.get('Authorization'))
			fetch(likeUrl, {
				headers: header,
				method: 'GET', // *GET, POST, PUT, DELETE, etc.
			}).then(res => console.log(res.json()));
		} else { //unlike
			fetch(unlikeUrl, {
				headers: {
					'Authorization': `Bearer ${token}`,
				},
				method: 'GET', // *GET, POST, PUT, DELETE, etc.
			}).then(res => console.log(res.json()));;
		}
	};
}

window.addEventListener("DOMContentLoaded", app.init);
window.addEventListener("DOMContentLoaded", likeButton);
window.addEventListener("DOMContentLoaded", Listlist);
window.addEventListener("DOMContentLoaded", addVideo);