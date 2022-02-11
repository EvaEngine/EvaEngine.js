list:
	@echo "build"

pre-build:
	npm install -g ava nyc
build:
	git pull
	npm install

publish:
	npm config delete registry
	npm publish
	npm config set registry "https://registry.npmmirror.com"
