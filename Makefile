WEB-EXT=../node_modules/.bin/web-ext

mk_sources:
	@mkdir -p dst
	@cp -R src/* dst/
	@cp LICENSE dst/
	@echo "sources ready"

lint: mk_sources
	$(WEB-EXT) lint --source-dir=dst

build: mk_sources
	$(WEB-EXT) build --source-dir=dst --artifacts-dir=dist

clean:
	@rm -rf dst/
	@echo "clean done"
