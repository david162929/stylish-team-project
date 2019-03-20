//儲存喜愛商品 -> 移除喜愛商品 -> 取得喜愛商品 

function getCookies(name) {
	let result = null;
	cookies = document.cookie.split('; ');
	cookies.forEach(element => {
		if (element.indexOf(name) >= 0) {
			result = element.split('=')[1];
		}
	});

	return result; // null if not found
}

function getLike() {
	//測試用
	// let data = {
	// 	"data": {
	// 		"id": ["201807201824", "201807202140", "201807202150"]
	// 	}
	// }

	// showProducts(data)
	const token = getCookies('token');
	const getLikeURL = 'https://davidadm.com/api/1.0/user/favorite-get';
	fetch(getLikeURL, {
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			method: 'GET', // *GET, POST, PUT, DELETE, etc.
		}).then(res => res.json())
		.then(function (data) {
			showProducts(data);
		});
};

//讀出該 id 的商品標題、圖片、價錢、點進去又回到該商品
function showProducts(data) {
	console.log(data)
	for (let i = 0; i < data.data.id.length; i += 1) {
		let id = data.data.id[i];
		let url = `https://api.appworks-school.tw/api/1.0/products/details?id=${id}`;

		let containerFav = document.createElement('div');
		let title = document.createElement('div');
		title.setAttribute('class', 'title');
		let pic = document.createElement('div');
		let img = document.createElement('img');
		pic.setAttribute('class', 'pic');
		let price = document.createElement('div');
		price.setAttribute('class', 'price');
		let main = document.getElementsByTagName('main')[0];
		containerFav.setAttribute('class', 'container-fav');

		main.appendChild(containerFav);
		containerFav.appendChild(title);
		containerFav.appendChild(pic);
		pic.appendChild(img);
		containerFav.appendChild(price);

		containerFav.addEventListener("click", function () {
			window.location = `product.html?id=${id}`;
		});


		fetch(url, {
				method: 'GET', // *GET, POST, PUT, DELETE, etc.
			}).then(res => res.json())
			.then(function (data) {
				title.innerHTML = data.data.title;
				price.innerHTML = data.data.price;
				img.src = data.data.main_image;
			});
	};
}



//三個一樣的東東
// data => console.log(data)

// funcion XXX(data) {
// 	console.log(data)
// }

// XXX = (data) => {
// 	console.log(data)
// }

// data => console.log(data);

window.addEventListener("DOMContentLoaded", getLike);