'strict mode';

const textHeight = 32;
const textCanvas = document.createElement('canvas');
//document.body.appendChild(textCanvas);
//textCanvas.style.position = "fixed";
const maxWidth = textCanvas.width = textCanvas.height = 1024;
const ctx = textCanvas.getContext('2d');
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.font = textHeight + "px Verdana";
ctx.textBaseline = "bottom";
ctx.fillStyle = "#aaa";

// from https://delphic.me.uk/tutorials/webgl-text
function createMultilineText(ctx, textToWrite, maxWidth, text) {
    var currentText = textToWrite;
    var futureText;
    var subWidth = 0;
    var maxLineWidth = 0;

    var wordArray = textToWrite.split(" ");
    var wordsInCurrent, wordArrayLength;
    wordsInCurrent = wordArrayLength = wordArray.length;

    // Reduce currentText until it is less than maxWidth or is a single word
    // futureText var keeps track of text not yet written to a text line
    while (ctx.measureText(currentText).width > maxWidth && wordsInCurrent > 1) {
        wordsInCurrent--;
        currentText = futureText = "";
        for (var i = 0; i < wordArrayLength; i++) {
            if (i < wordsInCurrent) {
                currentText += wordArray[i];
                if (i + 1 < wordsInCurrent) currentText += " ";
            } else {
                futureText += wordArray[i];
                if (i + 1 < wordArrayLength) futureText += " ";
            }
        }
    }
    text.push(currentText); // Write this line of text to the array
    maxLineWidth = ctx.measureText(currentText).width;

    // If there is any text left to be written call the function again
    if (futureText) {
        subWidth = createMultilineText(ctx, futureText, maxWidth, text);
        if (subWidth > maxLineWidth) {
            maxLineWidth = subWidth;
        }
    }

    // Return the maximum line width
    return maxLineWidth;
}

module.exports = {
    init(texture, textToWrite, paintingWidth=maxWidth) {
        var text = [];
        createMultilineText(ctx, textToWrite, Math.min(paintingWidth*maxWidth, maxWidth), text);

        ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
        for (var i = 0; i < text.length; i++) {
            ctx.fillText(text[i], 0, textCanvas.height - (Math.max(text.length, 3) - i) * textHeight);
        }

        return texture({
            data: textCanvas,
            min: 'mipmap',
            mipmap: 'nice',
            flipY: true
        });
    },
    draw(regl) {
        return regl({
            frag: `
            precision mediump float;
            uniform sampler2D tex;
            varying vec2 uv;
        
            void main () {
                float c = texture2D(tex, uv).r;
                gl_FragColor = vec4(0,0,0, c);
            }`,
            vert: `
            precision highp float;
            uniform mat4 proj, view, model;
            uniform float yScale;
            attribute vec2 pos;
            varying vec2 uv;
            void main () {
                uv = pos;
                vec4 mpos = model * vec4(pos, 0.001, 1);
                mpos.y *= yScale;
                gl_Position = proj * view * mpos;
            }`,
            attributes: {
                pos: [0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0]
            },
            uniforms: {
                model: regl.prop('textmodel'),
                tex: regl.prop('text')
            },
            count: 6,

            blend: {
                enable: true,
                func: {
                    srcRGB: 'src alpha',
                    srcAlpha: 'one minus src alpha',
                    dstRGB: 'one minus src alpha',
                    dstAlpha: 1
                },
                color: [0, 0, 0, 0]
            }
        });
    }
};