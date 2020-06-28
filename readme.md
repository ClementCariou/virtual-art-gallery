# [Virtual Art Gallery](https://clementcariou.github.io/virtual-art-gallery/build)

[![screenshot](ArtGallery.png "App screenshot")](https://clementcariou.github.io/virtual-art-gallery/build)

## Description

This project simulates an art gallery in your browser using [REGL](https://github.com/regl-project/regl).
It aims at reproducing the experience of a real art gallery.
The architecture is generated using a 10km long 6th order [Hilbert Curve](https://en.wikipedia.org/wiki/Hilbert_curve).
The paintings are asynchronously loaded from the [ARTIC](https://aggregator-data.artic.edu/home) and placed on the walls.

You can use this project to display your own artworks. Futur changes will make this process simpler.

## Setup

Installation :
```shell
git clone https://github.com/ClementCariou/virtual-art-gallery.git
npm install
```
Start the budo dev server : 
```shell
npm start
```
Build : 
```shell
npm build
```

## Evolutions

- search, filter and sort
- painting metadata redirect
- painting logarithm scale
- dynamic ambiant sound
- props for variety
- webvr

## Known issues

- load time (we are using a reverse proxy to get around the cors policy)
- random camera rotation
- incorrect painting shadows
- ceiling lighting seams
- no specular
