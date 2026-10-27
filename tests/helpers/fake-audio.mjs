export class FakeAudio extends EventTarget {
    paused = true;
    ended = false;
    currentTime = 0;
    duration = 42;
    error = null;
    playCalls = 0;
    pauseCalls = 0;
    loadCalls = 0;
    failure = false;
    async play() {
        this.playCalls++;
        if (this.failure) throw Error('blocked');
        this.paused = false;
        this.dispatchEvent(new Event('playing'));
    }
    pause() {
        this.pauseCalls++;
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
    }
    load() {
        this.loadCalls++;
        this.error = null;
    }
    removeAttribute() {}
}
