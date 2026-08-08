list:
	@echo "build"

pre-build:
	npm install
build:
	git pull
	npm install

publish:
	npm config delete registry
	npm publish
	npm config set registry "https://registry.npm.taobao.org"
