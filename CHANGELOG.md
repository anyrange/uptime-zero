# Changelog

## [0.9.0](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.8.0...uptime-zero-v0.9.0) (2026-06-09)


### Features

* update a lot ([6f3f220](https://github.com/anyrange/uptime-zero/commit/6f3f220e6b3a4d0ecc01f284c916dba6f283ba4a))

## [0.8.0](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.7.0...uptime-zero-v0.8.0) (2026-06-09)


### Features

* clean up dashboard ([3efccf4](https://github.com/anyrange/uptime-zero/commit/3efccf4c9b04badad71d149879a2cb136f090d76))
* show live incident duration ([4a424fc](https://github.com/anyrange/uptime-zero/commit/4a424fcd4de922f8a4b3cf9d9b16f131afefd77a))
* update dashboard ([c5c4250](https://github.com/anyrange/uptime-zero/commit/c5c4250d0f1439172efb64acd64a0f57d48b59e7))
* update dashboard look and feel ([ae5b630](https://github.com/anyrange/uptime-zero/commit/ae5b630a0722ccfc2c84f240fed6422532b335bf))


### Bug Fixes

* migrate off properly ([aaa2a42](https://github.com/anyrange/uptime-zero/commit/aaa2a4240279fae541c34f634c32ab0723641581))
* support old import format ([024504d](https://github.com/anyrange/uptime-zero/commit/024504db68323291b7fd25e9b2d86ea27d67d66b))


### Styles

* format changes ([1206c30](https://github.com/anyrange/uptime-zero/commit/1206c30e9da38b97244b64b32f1ea88e262ae7de))


### Code Refactoring

* replace cron monitor checks with SchedulerActor ([6b5cb62](https://github.com/anyrange/uptime-zero/commit/6b5cb62ddd23ac0a10b3ed5dc32bdc4461425782))


### Continuous Integration

* make demo sync update source sha ([d289c8b](https://github.com/anyrange/uptime-zero/commit/d289c8b0696600415c7bd9748544b3340a478b4a))

## [0.7.0](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.6.2...uptime-zero-v0.7.0) (2026-06-09)


### Features

* replace ssl checks with graceful period ([dec2505](https://github.com/anyrange/uptime-zero/commit/dec250543defcce3197a35ba876c11a0d2bcf3ca))


### Bug Fixes

* clean up issues ([9a77f5a](https://github.com/anyrange/uptime-zero/commit/9a77f5ae1df7b69a075df6e5289c61747c43223e))
* update query invalidation ([501cefd](https://github.com/anyrange/uptime-zero/commit/501cefdbb2700ecd531877130740f704c2e2fde8))


### Continuous Integration

* update sync action ([6a46be3](https://github.com/anyrange/uptime-zero/commit/6a46be3deb90fcbe7b192f67f06010168b7ffb44))

## [0.6.2](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.6.1...uptime-zero-v0.6.2) (2026-06-09)


### Performance Improvements

* move monitor checks out of Durable Objects ([052a5ca](https://github.com/anyrange/uptime-zero/commit/052a5ca39d257eb9538608bd537140652e47f907))


### Continuous Integration

* rebase properly ([4aaec91](https://github.com/anyrange/uptime-zero/commit/4aaec9176dc466d230e928d6f55378b18c9a45b6))
* sync demo branch on each commit ([16a6055](https://github.com/anyrange/uptime-zero/commit/16a6055d0f2766e0e440af717d7a36adfa5a4427))

## [0.6.1](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.6.0...uptime-zero-v0.6.1) (2026-06-08)


### Bug Fixes

* reduce sampling to ease on observability limits ([778e888](https://github.com/anyrange/uptime-zero/commit/778e888eaae964adc0bf7ff9d7f10221cb27a5f7))


### Code Refactoring

* update app layout ([8391b7c](https://github.com/anyrange/uptime-zero/commit/8391b7ce90279b2cd831e7a7b80e4d9577b9d7f7))

## [0.6.0](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.5.0...uptime-zero-v0.6.0) (2026-06-08)


### Features

* close up security issues and app boilerplate ([d8fcad8](https://github.com/anyrange/uptime-zero/commit/d8fcad8659498a637a8e093e66cbce67b1798931))
* update dashboard ([ab2c12a](https://github.com/anyrange/uptime-zero/commit/ab2c12a4f95a6ae760c7a4fbb6f27a2017efbb43))


### Bug Fixes

* **overview:** change blocks order ([1259440](https://github.com/anyrange/uptime-zero/commit/1259440cfb9a0808b29afaf7aaa144c89f0d24c1))


### Documentation

* update readme ([7273093](https://github.com/anyrange/uptime-zero/commit/7273093675ed3e498eb02ddbfab7aee71386889f))
* update wording ([4351971](https://github.com/anyrange/uptime-zero/commit/4351971e5d8a7dfa4a38b84b4f5cd44970e6c3af))

## [0.5.0](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.4.0...uptime-zero-v0.5.0) (2026-06-08)


### Features

* add command menu ([a485d2e](https://github.com/anyrange/uptime-zero/commit/a485d2eb512c2aead77b787d8676fa0b9ac13ac1))
* add scheduled monitors and polish admin UI states ([e61b2ef](https://github.com/anyrange/uptime-zero/commit/e61b2ef172b75f48dc9ffa9c3a652e39e5d33da4))

## [0.4.0](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.3.0...uptime-zero-v0.4.0) (2026-06-08)


### Features

* update dashboard to show version ([f9b04ba](https://github.com/anyrange/uptime-zero/commit/f9b04ba7d967a3fc7c01dffc5ce399d45f51ff6b))


### Performance Improvements

* optimize dashboard loading ([69eb3aa](https://github.com/anyrange/uptime-zero/commit/69eb3aac0a78cfd98dd6cf2c0bec3cce30af2bb8))


### Continuous Integration

* prevent running release-please in forks ([057ccb7](https://github.com/anyrange/uptime-zero/commit/057ccb73b9805fdd1fc88cd0b56e0e0a1d0728ad))

## [0.3.0](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.2.0...uptime-zero-v0.3.0) (2026-06-08)


### Features

* update logo and favicon ([c6a3e3d](https://github.com/anyrange/uptime-zero/commit/c6a3e3d1b4196960db6bb0c04c73eded954956a1))


### Miscellaneous Chores

* ignore changelog formatting ([b118aed](https://github.com/anyrange/uptime-zero/commit/b118aed24bc88b2dce10e35694ec667eff62dfa7))

## [0.2.0](https://github.com/anyrange/uptime-zero/compare/uptime-zero-v0.1.0...uptime-zero-v0.2.0) (2026-06-08)


### Features

* init uptime zero ([f61aad0](https://github.com/anyrange/uptime-zero/commit/f61aad0a1c6d5eb19ec94756d5aaceaafe2bbe45))


### Documentation

* update deployment guide ([cea4510](https://github.com/anyrange/uptime-zero/commit/cea4510d2c57604074006e662d67c7cb6548e1b6))
* update readme ([547da71](https://github.com/anyrange/uptime-zero/commit/547da71c2b07290771bf24635f3a7e8e72cb0692))
* update readme ([338ac5f](https://github.com/anyrange/uptime-zero/commit/338ac5f25a6780e35559dbcfb1695ff9910399d0))


### Miscellaneous Chores

* install skills ([7194711](https://github.com/anyrange/uptime-zero/commit/71947112e688b8f891cd93729cf56f5ac41127f5))
* remove leftovers ([f43661c](https://github.com/anyrange/uptime-zero/commit/f43661cf6cbf1fd5fba856b2cc0f0fc5df04569a))


### Continuous Integration

* add release-please ([8a4351d](https://github.com/anyrange/uptime-zero/commit/8a4351dfcd8b7cb5c7ea35befacfa5a6cd370794))
