WEB-EXT=../node_modules/.bin/web-ext

mk_sources: clean
	@mkdir -p build
	@cp -R src/* build/
	@cp LICENSE build/
	@echo "sources ready"

lint: mk_sources
	$(WEB-EXT) lint --source-dir=build

build: mk_sources
	$(WEB-EXT) build --source-dir=build --artifacts-dir=dist

clean:
	@rm -rf build/
	@echo "clean done"
