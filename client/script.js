var videoElement = document.getElementById('video');
var flvPlayer = flvjs.createPlayer({
    type: 'flv',
    isLive: true,
    //url: '/show-stream'
    url: '/show-stream',
});
flvPlayer.attachMediaElement(videoElement);
flvPlayer.on('error', function (err) {
    console.log(err)
});
flvPlayer.load();
flvPlayer.play();