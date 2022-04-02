'strict mode';

// Local images
const images = require("../images/images.json").images.map((img,i)=>({...img, image_id:i}));
module.exports = {
    fetchList: async function (from, count) {
        return images.slice(from, from + count);//.map((img,i)=>({...img, image_id:i+from}));
    },
    fetchImage: async function (obj, advicedResolution) {
        const url = "images/" + obj.file;
        const blob = await fetch(url).then(res => res.blob());
        return {
            title: obj.title,
            image: blob
        };
    }
};