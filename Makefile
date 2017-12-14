WEB-EXT=../node_modules/.bin/web-ext

lint:
	$(WEB-EXT) lint --source-dir=src

build:
	$(WEB-EXT) build --source-dir=src --artifacts-dir=dist