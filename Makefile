list:
	@echo "build"

build:
	git pull
	npm install

publish:
	npm config set registry ""
	npm config set registry ""
	npm publish
	npm config set registry "https://registry.npm.taobao.org"
	npm config set registry "https://registry.npm.taobao.org"
