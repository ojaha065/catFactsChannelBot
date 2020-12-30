"use strict";

module.exports = function Utils() {
	// eslint-disable-next-line indent
    /**
     * Simple wrapper for setInterval
     * @param {Function} fn
     * @param {number} t
     */
	this.Timer = function(fn, t = Math.floor(Math.random() * 1000 * 60 * 60 * 18) + (1000 * 60 * 60 * 5)) {
		let time = t;
		let timer;

		this.stop = function() {
			clearInterval(timer);
			timer = null;
			return this;
		};

		this.start = function() {
			if (!timer) {
				timer = setInterval(fn, time);
			} else {
				console.warn("The Timer is already running!");
			}
			return this;
		};

		this.reset = function(newT = time) {
			time = newT;
			return this.stop().start();
		};

		this.resetRandom = function() {
			return this.reset(Math.floor(Math.random() * 1000 * 60 * 60 * 18) + (1000 * 60 * 60 * 5));
		};

		return this;
	};

	return this;
};