# Virtual Art Gallery

![screenshot](ArtGallery.png "App screenshot")

## Description

This project simulates an art gallery in your browser using REGL.
It aims at reproducing the experience of a real art gallery.
The architecture is generated using a 10km long 6th order Hilbert Curve.
The paintings are asynchronously loaded from the ARTIC and placed on the walls.

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

- dynamic painting resolution
- search, filter and sort
- painting metadata display / redirect
- painting logarithm scale
- dynamic ambiant sound
- props for variety
- webvr

## Known issues

- load time (we are using a reverse proxy to get around the cors policy)
- random camera rotation
- incorrect painting shadows
- floor pattern aliasing
- ceiling lighting seams
- no specular