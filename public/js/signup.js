//sign in
//一般會員註冊
//輸入 email, password 後點擊登入按鈕，判斷是否有此人，若有此人跳到 profile 頁，讀出姓名、email

function signup() {
	const url = 'https://davidadm.com/api/1.0/user/signup';
	const data = {
		"name": document.getElementById('login-name').value,
		"email": document.getElementById('login-account').value,
		"password": document.getElementById('login-password').value
	};

	// Default options are marked with *
	return fetch(url, {
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data), //把 object 轉乘 json 格式的字串，backend 會再轉乘
			//json // must match 'Content-Type' header
			method: 'POST', // *GET, POST, PUT, DELETE, etc.
			// mode: 'no-cors',

		})
		.then(response => {

			const {
				status
			} = response;

			// const status = response.status;

			if (status) {
				response.json().then(result => {
					console.log('result', result)

					// https://developer.mozilla.org/zh-TW/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
					const {
						access_token,
						access_expired
					} = result.data;

					document.cookie = `token=${access_token};max-age=${access_expired}`;
					//讓後端拿到資料，然後跳轉到 profile 頁面

					window.location = "profile.html";
				});
			} else {
				throw ('fetch error')
			}
			// 輸出成 json
		})
		.catch(err => console.log('error', err));
}



//一般會員登入
function signin(data) {
	const url = 'https://davidadm.com/api/1.0/user/signin';
	// Default options are marked with *
	console.log(data)
	return fetch(url, {
			headers: {
				'user-agent': 'Mozilla/4.0 MDN Example',
				'content-type': 'application/json'
			},
			body: JSON.stringify(data), // must match 'Content-Type' header
			method: 'POST', // *GET, POST, PUT, DELETE, etc.
			// mode: 'no-cors',
		})
		.then(response => {
			console.log(response)
			const {
				status
			} = response;

			// const status = response.status;

			if (status) {
				response.json().then(result => {
					const {
						access_token,
						access_expired
					} = result.data;

					document.cookie = `token=${access_token};max-age=${access_expired}`;
					//讓後端拿到資料確認，然後跳轉到 profile 頁面
					window.location = "profile.html";
				});
			} else {
				throw ('fetch error')
			}
			// 輸出成 json
		})
		.catch(err => console.log('error', err));
}

function getCookies(name) {
	let result = null;
	//用分號切開來，等於切左邊右邊
	cookies = document.cookie.split('; ');
	cookies.forEach(element => {
		if (element.indexOf(name) >= 0) {
			result = element.split('=')[1];
			//去拿 value
		}
	});

	return result; // null if not found
}

function checkFacebookLogin() {
	FB.getLoginStatus(function (response) {

		console.log(response)
		if (response.status === 'connected') {

			//把 fb 給的東西丟給 backend
			signin({
				"access_token": response.authResponse.accessToken,
				"provider": "facebook"
			});
		} else {
			//handle non login
		}
	});
}

(() => {

	if (app.state.auth !== null) {
		//window.location = "./"; //跳回首頁
	}
	app.fb.load();
	app.fb.statusChangeCallback = function () {
		if (app.state.auth !== null) {
			//window.location = "profile.html";
		}
	};

	const sign1 = document.getElementById('sign1');
	sign1.addEventListener("click", () => {
		signin({
			"email": document.getElementById('loginAccount').value,
			"password": document.getElementById('loginPassword').value,
			"provider": "native"
		})
	});

	const signUpButton = document.getElementById('signUpButton');
	signUpButton.addEventListener("click", () => {
		// TODO: fixme.
		signup({
			"email": document.getElementById('login-account').value,
			"password": document.getElementById('login-password').value,
			"provider": "native"
		})
	});

	const token = getCookies('token');
	if (token) {
		window.location = "profile.html";
	}
})();