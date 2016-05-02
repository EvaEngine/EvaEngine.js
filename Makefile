list:
	@echo "install"
	@echo "update"

install:
	npm install -g nodemon babel-cli gulp sequelize-cli mysql bower coffee-script git://github.com/AlloVince/sequelize-auto#feature/column-comments

upgrade:
	git pull
	npm install
	bower install --allow-root
	gulp build

sequelize-auto:
	sequelize-auto -o "./src/models" -d fmarket -h localhost -u root -x my_password -e mysql

deploy:
	ssh root@debit.bmqb.com "cd /opt/htdocs/bmqb_debit && make upgrade && supervisorctl restart all"

