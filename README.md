# oseriocn-weixin-server

Make sure you have

- [Node.js](http://nodejs.org/)

- [Git](http://git-scm.com/)

- [MongoDB](http://www.mongodb.org/)

## Running

```
git clone http://github.com/PeacePan/oseriocn-weixin-server.git
cd oseriocn-weixin-server
npm install
sudo npm start
```

## Setup for development

```
sudo npm install -g typescript
npm install gulp gulp-typescript tsd --save-dev
tsd install
vi ./typings/tsd.d.ts
insert "/// <reference path="custom/custom.d.ts" />"
gulp build
```
