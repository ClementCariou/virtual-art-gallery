'strict mode';

// ARTIC API
const searchURL = 'https://api.artic.edu/api/v1/artworks/search';
const imageURL = ({image_id}, res) => `https://www.artic.edu/iiif/2/${image_id}/full/${res},/0/default.jpg`;
const query = '?query[bool][must][][term][classification_titles.keyword]=painting&query[bool][must][][term][is_public_domain]=true';
const fields = '&fields=image_id,title,artist_title';
const resolutions = {"low": 400, "mid": 843, "high": 1686};

module.exports = {
    fetchList: async function (from, count) {
        const url = searchURL + query + fields + `&from=${from}&size=${count}`;
        const json = await fetch(url).then(res => res.json());
        return json.data.filter((d) => d.image_id);
    },
    fetchImage: async function (obj, advicedResolution) {
        const url = imageURL(obj, resolutions[advicedResolution]);
        const blob = await fetch(url).then(res => res.blob());
        return {
            title: obj.title + " - " + obj.artist_title,
            image: blob
        };
    }
};