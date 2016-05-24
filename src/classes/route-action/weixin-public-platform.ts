/// <reference path="../../../typings/tsd.d.ts" />

/**
 用戶文本消息格式：
 ToUserName 開發者微信號
 FromUserName 發送方帳號(一個OpenID)
 CreateTime 消息創建時間(長整數)
 MsgType (text, image, location, link, event)
 MsgId 消息id(長整數)

 Content 文本消息內容
 PicUrl 圖片連結
 Location_X x
 Location_Y y
 Scale　地圖縮放大小
 Label 位置信息

 Title 消息標題
 Description 消息描述
 Url　消息鏈結
 Event 事件類型；subscribe(訂閱)、unsubscribe(取消訂閱)、CLICK(自定義菜單點擊事件)等
 EventKey 事件KEY值，與自定義菜單接口中KEY值對應
 */
interface MessageFrom {
    toUserName: string;
    fromUserName: string;
    createTime: string;
    msgType: string;
    msgId: string;
    content: string;

    picUrl: string;
    mediaId: string;
    format: string;
    recognition: string;
    thumbMediaId: string;

    locationX: string;
    locationY: string;
    scale: string;
    label: string;
    latitude: string;
    longitude: string;
    precision: string;

    title: string;
    description: string;
    url: string;

    event: string;
    eventKey: string;
    ticket: string;

    // 設備訊息
    // 請求類型：
    // 0：退訂設備狀態
    // 1：心跳(心跳的處理方式跟訂閱一樣)
    // 2：訂閱設備狀態
    opType: string;
    deviceId: string;
    deviceType: string;
    sessionId: string;
    openId: string;
}

export class ActionWeixinPublicPlatform {
    private xml2js = require('xml2js');
    private sha1 = require('sha1');

    private mongodb: any;
    private wxapi: any;
    private wxcfg: any;
    private event: any;

    public constructor(mongodb, wxapi, wxcfg, event) {
        this.mongodb = mongodb;
        this.wxapi = wxapi;
        this.wxcfg = wxcfg;
        this.event = event; // 事件廣播器
    }

    /**
     * 以json回應要求
     * @param {any} res remote response to client
     * @param {Object} json 欲發送的json
     */
    private responseJSON = (res, json) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.type('json');
        res.status(200).json(json);
    }

    /**
     * 以xml文本回應要求
     * @param {any} res remote response to client
     * @param {string} xmlText 欲發送的xml文本
     */
    private responseXML = (res, xmlText: string) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/xml');
        res.type('xml');
        res.status(200).send(xmlText);
    }

    private nextForSignSucc(req, res) {

        res.status(200).send();
    }


    /**
     處理微信公眾平台的GET請求
     @param {any} req remote request from client
     @param {any} res remote response to client
     */
    private weixinPublicEntryGET(req, res) {
        // 驗證微信簽名
        if (req.query && req.query.signature && this.wxapi.checkSignature(req.query)) {
            console.log('weixin signature successful');

            // 簽名驗證成功
            if (req.query.echostr) {
                // 如果帶有echostr，直接回應echostr(微信公眾平台驗證)
                res.status(200).send(req.query.echostr);
            } else {
                this.nextForSignSucc(req, res);
            }
        } else {
            res.status(200).send('signature failed');
        }
    }

    /**
     處理微信公眾平台的POST請求
     @param {any} req remote request from client
     @param {any} res remote response to client
     */
    private weixinPublicEntryPOST(req, res) {
        // 獲取xml内容
        let buff = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => { buff += chunk; });

        // xml内容接收完畢
        req.on('end', () => {
            this.xml2js.parseString(buff, (err, json) => {
                if (err) {
                    err.status = 400;
                    res.status(err.status).send();
                    return;
                }

                console.log(json);

                let xml = json.xml;
                let msgFrom = <MessageFrom>{
                    toUserName: xml.ToUserName ? xml.ToUserName[0] : '',
                    fromUserName: xml.FromUserName ? xml.FromUserName[0] : '',
                    createTime: xml.CreateTime ? xml.CreateTime[0] : '',
                    msgType: xml.MsgType ? xml.MsgType[0] : ''
                };

                // 判斷收到用戶發送那種訊息
                switch (msgFrom.msgType) {
                    case 'text':
                        // 公眾平台收到用戶發送文字訊息
                        msgFrom.content = xml.Content ? xml.Content[0] : '';
                        msgFrom.msgId = xml.MsgId ? xml.MsgId[0] : '';
                        this.event.emit('wxUser.message.sendText', msgFrom);
                        break;
                    case 'image':
                        // 公眾平台收到用戶發送圖像訊息
                        msgFrom.picUrl = xml.PicUrl ? xml.PicUrl[0] : '';
                        msgFrom.mediaId = xml.MediaId ? xml.MediaId[0] : '';
                        msgFrom.msgId = xml.MsgId ? xml.MsgId[0] : '';
                        this.event.emit('wxUser.message.sendImage', msgFrom);
                        break;
                    case 'voice':
                        // 公眾平台收到用戶語音訊息
                        msgFrom.mediaId = xml.MediaId ? xml.MediaId[0] : '';
                        msgFrom.format = xml.Format ? xml.Format[0] : '';
                        msgFrom.recognition = xml.Recognition ? xml.Recognition[0] : ''; // 如果有開通公眾平台的語音識別功能後，微信會附帶識別結果
                        msgFrom.msgId = xml.MsgId ? xml.MsgId[0] : '';
                        this.event.emit('wxUser.message.sendVoice', msgFrom);
                        break;
                    case 'video':
                    case 'shortvideo':
                        // 公眾平台收到用戶視頻訊息
                        msgFrom.mediaId = xml.MediaId ? xml.MediaId[0] : '';
                        msgFrom.thumbMediaId = xml.ThumbMediaId ? xml.ThumbMediaId[0] : '';
                        msgFrom.msgId = xml.MsgId ? xml.MsgId[0] : '';
                        this.event.emit('wxUser.message.sendVideo', msgFrom);
                        break;
                    case 'location':
                        // 公眾平台收到用戶位置資訊
                        msgFrom.locationX = xml.Location_X ? xml.Location_X[0] : '';
                        msgFrom.locationY = xml.Location_Y ? xml.Location_Y[0] : '';
                        msgFrom.scale = xml.Scale ? xml.Scale[0] : '';
                        msgFrom.label = xml.Label ? xml.Label[0] : '';
                        msgFrom.msgId = xml.MsgId ? xml.MsgId[0] : '';
                        this.event.emit('wxUser.message.sendLocation', msgFrom);
                        res.status(200).send(); // 回覆給微信伺服器代表收到
                        return;
                    case 'link':
                        // 公眾平台收到用戶發送連結訊息
                        msgFrom.title = xml.Title ? xml.Title[0] : '';
                        msgFrom.description = xml.Description ? xml.Description[0] : '';
                        msgFrom.url = xml.Url ? xml.Url[0] : '';
                        msgFrom.msgId = xml.MsgId ? xml.MsgId[0] : '';
                        this.event.emit('wxUser.message.sendUrlLink', msgFrom);
                        break;
                    case 'event':
                        // 公眾平台收到用戶動作事件
                        msgFrom.event = xml.Event ? xml.Event[0].toLowerCase() : '';

                        switch (msgFrom.event) {
                            case 'subscribe':
                                msgFrom.eventKey = xml.EventKey ? xml.EventKey[0] : '';
                                msgFrom.ticket = xml.Ticket ? xml.Ticket[0] : '';

                                // 有使用者訂閱公眾號，將此使用者的openid(fromUserName)加入資料庫中或重新設為關注中
                                this.mongodb.updateWeixinUser({
                                    openid: msgFrom.fromUserName,
                                    subscribe: true
                                });
                                this.event.emit('wxUser.normalEvent.subscribe', msgFrom);

                                // 發送歡迎訊息給用戶
                                // this.wxapi.sendMessageToUser(msgFrom.fromUserName, 'text', { content: 'Hello, Welcome!' });
                                break;
                            case 'unsubscribe':
                                // 有使用者取消訂閱公眾號，將此使用者從資料庫設為取消關注
                                this.mongodb.updateWeixinUser({
                                    openid: msgFrom.fromUserName,
                                    subscribe: false
                                });
                                this.event.emit('wxUser.normalEvent.unsubscribe', msgFrom);
                                break;
                            case 'location':
                                msgFrom.latitude = xml.Latitude ? xml.Latitude[0] : '';
                                msgFrom.longitude = xml.Longitude ? xml.Longitude[0] : '';
                                msgFrom.precision = xml.Precision ? xml.Precision[0] : '';
                                this.event.emit('wxUser.normalEvent.receiveLocation', msgFrom);
                                break;
                            case 'click':
                                msgFrom.eventKey = xml.EventKey ? xml.EventKey[0] : '';
                                this.event.emit('wxUser.normalEvent.buttonClick', msgFrom);
                                break;
                            case 'view':
                                msgFrom.eventKey = xml.EventKey ? xml.EventKey[0] : '';
                                this.event.emit('wxUser.normalEvent.urlLinkClick', msgFrom);
                                break;
                            case 'scan':
                                msgFrom.eventKey = xml.EventKey ? xml.EventKey[0] : '';
                                msgFrom.ticket = xml.Ticket ? xml.Ticket[0] : '';
                                this.event.emit('wxUser.normalEvent.qrcodeScan', msgFrom);
                                break;
                            default:
                                break;
                        }
                        res.status(200).send(); // 回覆給微信伺服器代表收到
                        return;
                    case 'device_event':
                        // 公眾平台收到用戶動作事件
                        msgFrom.event = xml.Event ? xml.Event[0].toLowerCase() : '';
                        msgFrom.deviceId = xml.DeviceID ? xml.DeviceID[0] : '';
                        msgFrom.deviceType = xml.DeviceType ? xml.DeviceType[0] : '';

                        switch (msgFrom.event) {
                            case 'subscribe_status':
                                msgFrom.opType = xml.OpType ? xml.OpType[0] : '';
                                break;
                            case 'unsubscribe_status':
                                msgFrom.opType = xml.OpType ? xml.OpType[0] : '';
                                break;
                            case 'bind':
                                msgFrom.content = xml.Content ? xml.Content[0] : '';
                                msgFrom.sessionId = xml.SessionID ? xml.SessionID[0] : '';
                                msgFrom.openId = xml.OpenID ? xml.OpenID[0] : '';
                                this.event.emit('wxUser.deviceEvent.bind', msgFrom);
                                break;
                            case 'unbind':
                                msgFrom.content = xml.Content ? xml.Content[0] : '';
                                msgFrom.sessionId = xml.SessionID ? xml.SessionID[0] : '';
                                msgFrom.openId = xml.OpenID ? xml.OpenID[0] : '';
                                this.event.emit('wxUser.deviceEvent.unbind', msgFrom);
                                break;
                            default:
                                console.log('unknown event: ' + msgFrom.event);
                                break;
                        }
                        res.status(200).send(); // 回覆給微信伺服器代表收到
                        return;
                    default:
                        console.log('unknown message: ' + msgFrom.msgType);
                        res.status(200).send();
                        return;
                }

                // 不處理自動回覆
                res.status(200).send();

                // // 回覆文本訊息給用戶
                // let outputXml =
                //     '<xml>' +
                //         '<ToUserName><![CDATA[' + msgFrom.fromUserName + ']]></ToUserName>' +
                //         '<FromUserName><![CDATA[' + msgFrom.toUserName + ']]></FromUserName>' +
                //         '<CreateTime>' + Math.round(new Date().getTime() / 1000) + '</CreateTime>' +
                //         '<MsgType><![CDATA[' + 'text' + ']]></MsgType>' +
                //         '<Content><![CDATA[' + '嗨，你好！' + ']]></Content>' + 
                //     '</xml>';
                // console.log(outputXml);

                // // 回覆音樂訊息給用戶
                // let outputXml =
                // '<xml>' + 
                //      '<ToUserName><![CDATA[' + msgFrom.fromUserName + ']]></ToUserName>' + 
                //      '<FromUserName><![CDATA[' + msgFrom.toUserName + ']]></FromUserName>' + 
                //      '<CreateTime>' + Math.round(new Date().getTime() / 1000) + '</CreateTime>' + 
                //      '<MsgType><![CDATA[' + 'music' + ']]></MsgType>' + 
                //      '<Music>' + 
                //      '<Title><![CDATA[' + '音樂標題' + ']]></Title>' + 
                //      '<Description><![CDATA[' + '音樂描述' + 'DESCRIPTION]]></Description>' + 
                //      '<MusicUrl><![CDATA[' + '音樂URL' + ']]></MusicUrl>' + 
                //      '<HQMusicUrl><![CDATA[' + '高質量音樂URL' + ']]></HQMusicUrl>' + 
                //      '</Music>' + 
                // '</xml>';

                // // 回覆圖文訊息給用戶
                // let articles = [{
                //     title : 'PHP依賴管理工具Composer入門',
                //     description : 'PHP依賴管理工具Composer入門',
                //     picUrl : 'http://weizhifeng.net/images/tech/composer.png',
                //     url : 'http://weizhifeng.net/manage-php-dependency-with-composer.html'
                // }, {
                //     title : '八月西湖',
                //     description : '八月西湖',
                //     picUrl : 'http://weizhifeng.net/images/poem/bayuexihu.jpg',
                //     url : 'http://weizhifeng.net/bayuexihu.html'
                // }, {
                //     title : '「翻譯」Redis協議',
                //     description : '「翻譯」Redis協議',
                //     picUrl : 'http://weizhifeng.net/images/tech/redis.png',
                //     url : 'http://weizhifeng.net/redis-protocol.html'
                // }];
                // let articlesStr = '';   
                // for (let i = 0; i < articles.length; i++) {
                //     articlesStr +=
                //     '<item>' + 
                //         '<Title><![CDATA[' + articles[i].title + ']]></Title>' + 
                //         '<Description><![CDATA[' + articles[i].description + ']]></Description>' + 
                //         '<PicUrl><![CDATA[' + articles[i].picUrl + ']]></PicUrl>' + 
                //         '<Url><![CDATA[' + articles[i].url + ']]></Url>' + 
                //     '</item>';
                // }
                // let outputXml = 
                // '<xml>' + 
                //      '<ToUserName><![CDATA[' + msgFrom.fromUserName + ']]></ToUserName>' + 
                //      '<FromUserName><![CDATA[' + msgFrom.toUserName + ']]></FromUserName>' + 
                //      '<CreateTime>' + Math.round(new Date().getTime() / 1000) + '</CreateTime>' + 
                //      '<MsgType><![CDATA[' + 'news' + ']]></MsgType>' + 
                //      '<ArticleCount>' + articles.length + '</ArticleCount>' +
                //      '<Articles>' + articlesStr + '</Articles>' +
                // '</xml>';

                // this.responseXML(res, outputXml);
            });
        });
    }
}