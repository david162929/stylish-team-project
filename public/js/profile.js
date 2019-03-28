//FB 的順序要調整
//先進入註冊頁面 -> 註冊成功或登入成功才會進 profile 頁面
//下次再點 profile 頁面會讀 user profile 的一個 id 值去確認



// //讀從後端拿出來的資料然後印出來
// if (typeof (Storage) !== "undefined") {
// 	console.log(localStorage);
// 	var username = document.getElementById('load_name');
// 	var email = document.getElementById('load_email');
// 	var picture = document.getElementById('profile_picture');
// 	var data = localStorage.getItem('personalData');
// 	data = JSON.parse(data);


// 	username.innerHTML = data.usename;
// 	email.innerHTML = data.userEmail;
// 	picture.innerHTML = data.userPicture;
// } else {
// 	// No web storage Support.
// }

const token = getCookies('token');
if (!token) {
	window.location = "signup.html";
}

app.init = function () {
	app.fb.statusChangeCallback = app.initProfile;
};
app.initProfile = function () {
	if (app.state.auth === null) {
		//window.location = "./";
	}
	app.fb.getProfile().then(function (data) {
		app.showProfile(data);
	}).catch(function (error) {
		console.log("Facebook Error", error);
		profile();
	});
};
app.showProfile = function (data) {
	app.get("#profile_picture").src = "https://graph.facebook.com/" + data.id + "/picture/?width=200";
	document.getElementById('load_name').innerText = data.name;
	document.getElementById('load_email').innerText = data.email;
	const imageUpload = document.getElementById('image_uplaod');
	console.log(imageUpload);
	imageUpload.style.display = 'none';
};
window.addEventListener("DOMContentLoaded", app.init);


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

//拿 user 的 profile 
function profile() {
	const token = getCookies('token');
	if (!token) {
		return;
	}

	const url = 'https://davidadm.com/api/1.0/user/profile';
	const profileDom = {
		"name": document.getElementById('load_name'),
		"email": document.getElementById('load_email'),
		"picture": document.getElementById('profile_picture'),
	};

	fetch(url, {
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			method: 'GET', // *GET, POST, PUT, DELETE, etc.
		})
		.then(res => res.json())
		.then(jsonResponse => {
			if (jsonResponse.error) {
				// handle error
				return;
			}
			let {
				name,
				email,
				picture
			} = jsonResponse.data;

			profileDom.email.innerText = email;
			profileDom.name.innerText = name;
			if (picture) {
				profileDom.picture.src = picture;
			}
		})
}

(function () {

	const imageUpload = document.getElementById('image_uplaod');
	console.log('aaaa')
	imageUpload.onsubmit = (event) => {
		event.preventDefault();

		const url = 'https://davidadm.com/api/1.0/admin/avatar';
		const token = getCookies('token');
		if (!token) {
			return;
		}
		const formData = new FormData(imageUpload);

		const ava = formData.entries().next().value;
		if (ava[1].size === 0) {
			// no file will be upload
			return;
		} else if (ava[1].name === '') {
			// invaild file name
			return;
		}

		fetch(url, {
			headers: {
				'Authorization': `Bearer ${token}`,
			},
			method: 'POST',
			body: formData,
		}).then(response => {
			console.log(response);
		});

	};
})();

//上傳照片的 node.js 怎麼開ㄚ？