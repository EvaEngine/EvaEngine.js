list:
	@echo "build"

build:
	git pull
	npm install

sequelize-auto:
	sequelize-auto -o "./src/models" -d fmarket -h localhost -u root -x my_password -e mysql
