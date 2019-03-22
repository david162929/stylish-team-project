app.init = function () {
	let number = app.getParameter("number");
	console.log(number);
	if (!number) {
		window.location = "./";
	}
	app.get("#number").textContent = number;
	app.cart.init();
	pushNotification();
};
window.addEventListener("DOMContentLoaded", app.init);


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

//收信 pushnotification
function pushNotification() {
	const url = 'https://davidadm.com/api/1.0/admin/email-send';

	const data = {
		"user_token": getCookies('token'),
		"order_number": app.getParameter("number")
	};
	console.log(data);
	/*
	const headers = {
		"Authorization": "Bearer iamacoolguyilovetaiwan",
	}

	let req = new XMLHttpRequest();
	req.addEventListener("load", (e) => {
		debugger;
	});
	req.open("POST", url);
	req.setRequestHeader('Authorization', 'Bearer iamacoolguyilovetaiwan');
	//req.setRequestHeader('Content-Type', "application/json")

	req.send(JSON.stringify(data));
	*/
	/*
	app.ajax("post", url, data, headers, function (req) {
		let result = JSON.parse(req.responseText);
		console.log('result', result);
		debugger;
	});
	*/

	// Default options are marked with *
	return fetch(url, {
			headers: new Headers({
				"Content-Type": "application/json",
				"Authorization": "Bearer iamacoolguyilovetaiwan",
			}),
			body: JSON.stringify(data), //把 object 轉乘 json 格式的字串，backend 會再轉乘
			//json // must match 'Content-Type' header
			method: 'POST', // *GET, POST, PUT, DELETE, etc.
			// mode: 'no-cors',
		})
		.then(response => {
			console.log(response);

			const {
				status
			} = response;

			// const status = response.status;

			if (status) {
				response.json().then(result => {
					console.log('result', result)
				});
			} else {
				throw ('fetch error')
			}
			// 輸出成 json
		})
		.catch(err => console.log('error', err));

}