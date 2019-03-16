// MySQL Initialization
const mysql = require("mysql2");
const Client = require('ssh2').Client;

/* const mysqlCon=mysql.createConnection({
	host:"localhost",
	user:"root",
	password:"123456",
	database:"stylish"
});
mysqlCon.connect(function(err){
	if(err){
		throw err;
	}else{
		console.log("Connected!");
	}
}); */

let mysqlCon;	//can't use const

const ssh = new Client();
ssh.on('ready', function() {
	ssh.forwardOut(
		'127.0.0.1',
		12345,
		'127.0.0.1',
		3306,
		function (err, stream) {
			if (err) throw err;
			mysqlCon = mysql.createConnection({
			  user: 'root',
			  database: 'stylish',
			  password: '567TYUghj@$^*',
			  stream: stream,
			});		
				
			// use sql connection as usual
			mysqlCon.query("SELECT id FROM product", function (err, result, fields) {
				if (err) throw err;
				console.log("Connect to MySQL succeed!");
			});
			
			module.exports={
				core:mysql,
				con:mysqlCon
			};
				
		});
	}).connect({
	// ssh connection config ...
	host: '52.15.89.192',
	port: 22,
	username: 'ec2-user',
	privateKey: require('fs').readFileSync(".ssh/2019-2-14-keyPair.pem")
}); 



