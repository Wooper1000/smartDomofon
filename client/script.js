

fetch('http://localhost:3000/test',{
    method:'GET',
    mode: 'no-cors',
})
    .then(async (response) => {
        const responseBlob = await response.data.blob()
        console.log(responseBlob)
        const img = document.createElement('img')
        img.src = "data:image/png;base64"+responseBlob
        document.querySelector(`body`).append(img)
    })
