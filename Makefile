list:
	@echo "build"

build:
	git pull
	npm install

publish:
	npm config delete registry
	npm publish
	npm config set registry "https://registry.npm.taobao.org"
