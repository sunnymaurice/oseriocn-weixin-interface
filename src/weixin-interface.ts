/// <reference path="../typings/tsd.d.ts" />

class WeixinInterface {
    private EventEmitter = require('events').EventEmitter;

    private MongodbBridge = require('./classes/mongodb-bridge/mongodb-bridge.js').MongodbBridge;
    private WeixinBridge = require('./classes/weixin-bridge/weixin-bridge.js').WeixinBridge;
    private ActionFrontEndAPI = require('./classes/route-action/front-end-api.js').ActionFrontEndAPI;
    private ActionWeixinPublicPlatform = require('./classes/route-action/weixin-public-platform.js').ActionWeixinPublicPlatform;
    
    private rtcfg = require('./configs/route.json');
    private wxcfg = require('./configs/weixin.json');
    private dbcfg = require('./configs/mongodb.json');

    private actWxHwPlatform: any;
    private actWxPubPlatform: any;
    private actFrontEnd: any;

	public app: any;
    public db: any;
    public options: any;
    public mongodbBridge: any;
    public weixinBridge: any;
    public event: any;

    public constructor(expressApp, mongoDB, options) {
        this.app = expressApp;
        this.db = mongoDB;
        this.options = options ? options : {};
        this.wxcfg.WX_APPID = this.options.appid;
        this.wxcfg.WX_APPSECRET = this.options.appSecret;
        this.wxcfg.WX_TOKEN = this.options.token;

        this.event = new this.EventEmitter(); // 宣告事件廣播器
        this.event.setMaxListeners(30); // 設定最多30個事件(預設10個)

        this.mongodbBridge = new this.MongodbBridge(this.db, this.dbcfg);
        this.weixinBridge = new this.WeixinBridge(this.db, this.wxcfg, this.rtcfg);

        this.actFrontEnd = new this.ActionFrontEndAPI(this.mongodbBridge, this.weixinBridge, this.rtcfg, this.event);
        this.actWxPubPlatform = new this.ActionWeixinPublicPlatform(this.mongodbBridge, this.weixinBridge, this.wxcfg, this.event);


        // 設定接受微信公眾平台的接口路由位置
        this.app.get(this.rtcfg.WX_PREFIX + this.rtcfg.WX_PUBLIC_ENTRY, (req, res) => { this.actWxPubPlatform.weixinPublicEntryGET(req, res); });
        this.app.post(this.rtcfg.WX_PREFIX + this.rtcfg.WX_PUBLIC_ENTRY, (req, res) => { this.actWxPubPlatform.weixinPublicEntryPOST(req, res); });

        // 處理前端網頁授權相關
        this.app.get(this.rtcfg.WX_PREFIX + this.rtcfg.WX_OAUTH, (req, res) => { this.actFrontEnd.oauthCheck(req, res); });
        this.app.get(this.rtcfg.WX_PREFIX + this.rtcfg.WX_OAUTH_REDIRECT, (req, res) => { this.actFrontEnd.oauthRedirect(req, res); });

        /**************************************
         *************** 前端API ***************
         **************************************/
        // 處理前端JSSDK簽名相關
        this.app.get(this.rtcfg.FRONT_END_API + this.rtcfg.F_JS_SDK, (req, res) => { this.actFrontEnd.jsSign(req, res); });
        this.app.post(this.rtcfg.FRONT_END_API + this.rtcfg.F_JS_SDK, (req, res) => { this.actFrontEnd.jsSign(req, res); });

        // 處理前端與後端的使用者資料交互
        this.app.post(this.rtcfg.FRONT_END_API + this.rtcfg.F_USER, (req, res) => { this.actFrontEnd.user(req, res); });

        // 處理前端與裝置資料交互
        this.app.post(this.rtcfg.FRONT_END_API + this.rtcfg.F_DEVICE, (req, res) => { this.actFrontEnd.device(req, res); });
    }

    /**
     * 獲取微信基礎接口的存取權杖
     */
    public fetchBaseAccessToken() {
        return this.weixinBridge.getBaseAccessToken();
    }

    /**
     * http://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421140547&token=&lang=zh_CN
     * 發送圖片消息至用戶
     */
    public sendTextToUser(openid, text) {
        if (!openid) {
            return new Promise<any>((resolve, reject) => {
                reject('openid is necessary');
            });
        } else if (!text) {
            return new Promise<any>((resolve, reject) => {
                reject('empty text');
            });
        } else {
            return this.weixinBridge.sendMessageToUser(openid, 'text', { content: text });
        }
    }

    /**
     * 發送圖片消息至用戶
     */
    public sendImageToUser(openid, image_id) {
        if (!openid) {
            return new Promise<any>((resolve, reject) => {
                reject('openid is necessary');
            });
        } else if (!image_id) {
            return new Promise<any>((resolve, reject) => {
                reject('media_id is necessary');
            });
        } else {
            return this.weixinBridge.sendMessageToUser(openid, 'image', { media_id: image_id });
        }
    }

    /**
     * 發送語音消息至用戶
     */
    public sendVoiceToUser(openid, voice_id) {
        if (!openid) {
            return new Promise<any>((resolve, reject) => {
                reject('openid is necessary');
            });
        } else if (!voice_id) {
            return new Promise<any>((resolve, reject) => {
                reject('media_id is necessary');
            });
        } else {
            return this.weixinBridge.sendMessageToUser(openid, 'voice', { media_id: voice_id });
        }
    }

    /**
     * 發送視頻消息至用戶
     */
    public sendVideoToUser(openid, param) {
        if (!openid) {
            return new Promise<any>((resolve, reject) => {
                reject('openid is necessary');
            });
        } else if (!param || !(param instanceof Object)) {
            return new Promise<any>((resolve, reject) => {
                reject('video options is necessary');
            });
        } else {
            return this.weixinBridge.sendMessageToUser(openid, 'video', param);
        }
    }

    /**
     * 發送音樂消息至用戶
     */
    public sendMusicToUser(openid, param) {
        if (!openid) {
            return new Promise<any>((resolve, reject) => {
                reject('openid is necessary');
            });
        } else if (!param || !(param instanceof Object)) {
            return new Promise<any>((resolve, reject) => {
                reject('music options is necessary');
            });
        } else {
            return this.weixinBridge.sendMessageToUser(openid, 'music', param);
        }
    }

    /**
     * 發送圖文消息至用戶(點擊後跳轉到圖文消息頁面)
     */
    public sendResoureceNewsToUser(openid, news_id) {
        if (!openid) {
            return new Promise<any>((resolve, reject) => {
                reject('openid is necessary');
            });
        } else if (!news_id) {
            return new Promise<any>((resolve, reject) => {
                reject('news_id is necessary');
            });
        } else {
            return this.weixinBridge.sendMessageToUser(openid, 'mpnews', { media_id: news_id });
        }
    }

    /**
     * 發送圖文消息至用戶(點擊後跳轉至外部連結)
     */
    public sendNewsToUser(openid, news) {
        if (!openid) {
            return new Promise<any>((resolve, reject) => {
                reject('openid is necessary');
            });
        } else if (!(news instanceof Array)) {
            return new Promise<any>((resolve, reject) => {
                reject('the type of "news" must be array');
            });
        } else {
            // 圖文消息條數限制在8條以內
            if (news && news.length && news.length <= 8) {
                return this.weixinBridge.sendMessageToUser(openid, 'news', { articles: news });
            } else {
                return new Promise<any>((resolve, reject) => {
                    reject('News Parameter error');
                });
            }
        }
    }

    /**
     * 發送量測資料模板消息至用戶
     */
    public sendMesurementToUser(openid, param) {
        let valueColor = '#173177';
        let data = {};
        for (let k in param) {
            data[k] = {
                value: param[k],
                color: valueColor
            };
        }
        return this.weixinBridge.sendTemplateToUser(openid, 'fQI6hgWBxpCYMT67zeluoCwPsFkAsxspxuXGN4xC1-Q', this.rtcfg.HOST_ADDRESS + this.rtcfg.WX_PREFIX + this.rtcfg.WX_WEBPAGE, data);
    }
}

module.exports = function weixinInterface(app, db, opts) {
    return new WeixinInterface(app, db, opts);
};