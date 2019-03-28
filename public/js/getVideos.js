// 在 product 頁接 YouTube 影片
function getVideos() {
    const getVideosURL = '`https://davidadm.com/api/1.0/products/video-get?id=${id}`;;
    fetch(getVideosURL, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        method: 'GET',
    }).then(res => console.log(res.json()));
};