/// <reference path="../../../typings/tsd.d.ts" />

export class MongodbBridge {
    private assert = require('assert');
    private db: any;
    private dbcfg: any;

    private wxUserColl: any;
    private baseTokenColl: any;
    private jsapiColl: any;

    public constructor(mongoDB, dbcfg) {
        this.db = mongoDB;
        this.dbcfg = dbcfg;

        // 指向各個collectionName
        this.wxUserColl = this.db.collection(this.dbcfg.COLL_WEIXIN_USERS);
        this.baseTokenColl = this.db.collection(this.dbcfg.COLL_BASE_TOKEN);
        this.jsapiColl = this.db.collection(this.dbcfg.COLL_JSAPI_TICKET);
    }

    /**
     更新微信使用者的資料
     @param {any} userInfo 使用者資訊的物件(一定須包含openid項目)
     */
    public updateWeixinUser(userInfo) {
        // 若沒有初始化Mongodb，則直接回調
        if (!userInfo.openid) {
            return new Promise((resolve, reject) => { reject('Param error'); });
        } else {
            // 確保數值Type正確
            if (userInfo.sex !== undefined && typeof userInfo.sex !== 'number') {
                userInfo.sex = parseInt(userInfo.sex);
            }
            if (userInfo.height !== undefined && typeof userInfo.height !== 'number') {
                userInfo.height = parseFloat(userInfo.height);
            }
            if (userInfo.goal_weight !== undefined && typeof userInfo.goal_weight !== 'number') {
                userInfo.goal_weight = parseFloat(userInfo.goal_weight);
            }

            return new Promise((resolve) => {
                // 根據使用者openid更新資料庫
                this.wxUserColl.update({ openid: userInfo.openid }, { $set: userInfo }, { upsert: true }, (error, result) => {
                    this.assert.equal(error, null); // 寫入資料庫失敗擲出錯誤，中斷Node
                    resolve(result);
                });
            });
        }
    }

    /**
     根據指定的openid於資料庫中取出使用者資料
     @return {Promise} 非同步工作的承諾；成功取得使用者資訊後，攜帶DB結果回覆
     */
    public fetchWeixinUser(openid) {
        if (!openid) {
            return new Promise<any>((resolve, reject) => { reject('Param error'); });
        } else {
            return new Promise<any>((resolve) => {
                this.wxUserColl.findOne({ openid: openid }, (error, result) => {
                    this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                    resolve(result); // 找不到會回調null
                });
            });
        }
    }

    /**
     更新基礎接口的Token
     @return {Promise} 非同步工作的承諾；成功更新基礎接口Token後，攜帶DB結果回覆
     */
    public updateBaseToken(baseTokenNew) {
        if (!baseTokenNew) {
            return new Promise<any>((resolve, reject) => { reject('Param error'); });
        } else {
            return new Promise((resolve) => {
                this.baseTokenColl.findOne({}, (err, doc) => {
                    if (doc === null) {
                        // 資料庫內尚未有Token的紀錄，進行新增
                        this.baseTokenColl.insertOne(baseTokenNew, (error, result) => {
                            this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                            resolve(result);
                        });
                    } else {
                        // 更新資料庫
                        this.baseTokenColl.update({ _id: doc._id }, { $set: baseTokenNew }, { upsert: true }, (error, result) => {
                            this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                            resolve(result);
                        });
                    }
                });
            });
        }
    }

    /**
     於資料庫中取出微信公眾平台基礎接口的Access Token
     @return {Promise} 非同步工作的承諾；成功取出基礎接口的Access Token後，攜帶DB結果回覆
     */
    public fetchBaseToken() {
        return new Promise((resolve) => {
            this.baseTokenColl.findOne({}, (error, result) => {
                this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                resolve(result); // 找不到會回調null
            });
        });
    }

    /**
     更新生成jsapi所需的Ticket
     @return {Promise} 非同步工作的承諾；成功更新jsapi所需的Ticket後，攜帶DB結果回覆
     */
    public updateJsapiTicket(jsapiTicketNew) {
        if (!jsapiTicketNew) {
            return new Promise<any>((resolve, reject) => { reject('Param error'); });
        } else {
            return new Promise((resolve) => {
                this.jsapiColl.findOne({}, (err, doc) => {
                    if (doc === null) {
                        // 資料庫內尚未有Token的紀錄，進行新增
                        this.jsapiColl.insertOne(jsapiTicketNew, (error, result) => {
                            this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                            resolve(result);
                        });
                    } else {
                        // 更新資料庫
                        this.jsapiColl.update({ _id: doc._id }, { $set: jsapiTicketNew }, { upsert: true }, (error, result) => {
                            this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                            resolve(result);
                        });
                    }
                });
            });
        }
    }

    /**
     於資料庫中取出微信JSSDK生成簽名用的JSAPI Ticket
     @return {Promise} 非同步工作的承諾；成功取出微信JSSDK生成簽名用的JSAPI Ticket後，攜帶結果回覆
     */
    public fetchJsapiTicket() {
        return new Promise((resolve) => {
            this.jsapiColl.findOne({}, (error, result) => {
                this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                resolve(result); // 找不到會回調null
            });
        });
    }

    /**
     添加使用者綁定裝置的資料
     @param {string} openid 微信使用者的對此公眾號的唯一id
     @param {string} device_id 裝置的唯一id
     @param {string} product_id 裝置的產品型號
     */
    public addUserBindDevice(openid, device_id, product_id) {
        // 若沒有初始化Mongodb，則直接回調
        if (!openid || !device_id) {
            return new Promise<any>((resolve, reject) => { reject('Param error'); });
        } else {
            return new Promise((resolve) => {
                this.fetchWeixinUser(openid).then((userInfo) => {
                    let runDeviceUpdateTask = () => {
                        this.fetchDeviceInfo(device_id).then((deviceInfo) => {
                            let deviceAddDoc = {
                                product_id: product_id ? product_id : null,
                                device_id: device_id,
                                bind_users: deviceInfo && deviceInfo.bind_users ? deviceInfo.bind_users : []
                            };

                            if (deviceAddDoc.bind_users.indexOf(openid) < 0) {
                                deviceAddDoc.bind_users.push(openid);
                            }

                            // 根據使用者device_id更新資料庫
                            let collect = this.db.collection(this.dbcfg.COLL_WEIXIN_DEVICES);
                            collect.update({ device_id: deviceAddDoc.device_id }, { $set: deviceAddDoc }, { upsert: true }, (error, result) => {
                                this.assert.equal(error, null); // 寫入資料庫失敗擲出錯誤，中斷Node
                                resolve(result);
                            });
                        });
                    };

                    if (!userInfo) { userInfo = { openid: openid }; }
                    if (!userInfo.bind_devices) { userInfo.bind_devices = []; }

                    if (userInfo.bind_devices.indexOf(device_id) < 0) {
                        userInfo.bind_devices.push(device_id);
                        let userAddDoc = {
                            openid: openid,
                            bind_devices: userInfo.bind_devices
                        };
                        this.updateWeixinUser(userAddDoc).then(() => {
                            runDeviceUpdateTask();
                        });
                    } else {
                        runDeviceUpdateTask();
                    }
                });
            });
        }
    }

    public removeUserBindDevice(openid, device_id) {
        // 若沒有初始化Mongodb，則直接回調
        if (!openid || !device_id) {
            return new Promise<any>((resolve, reject) => { reject('Param error'); });
        } else {
            return new Promise((resolve) => {
                this.fetchWeixinUser(openid).then((userInfo) => {
                    if (!userInfo || (userInfo && !userInfo.bind_devices)) {
                        resolve();
                        return;
                    }

                    let runDeviceUpdateTask = () => {
                        this.fetchDeviceInfo(device_id).then((deviceInfo) => {
                            if (!deviceInfo || (deviceInfo && !deviceInfo.bind_users)) {
                                resolve();
                                return;
                            }

                            let uid_idx = deviceInfo.bind_users.indexOf(openid);
                            if (uid_idx >= 0) {
                                deviceInfo.bind_users.splice(uid_idx, 1); // 移除裝置內紀錄的用戶openid

                                let deviceAddDoc = {
                                    device_id: device_id,
                                    bind_users: deviceInfo.bind_users
                                };

                                // 根據使用者device_id更新資料庫
                                let collect = this.db.collection(this.dbcfg.COLL_WEIXIN_DEVICES);
                                collect.update({ device_id: deviceAddDoc.device_id }, { $set: deviceAddDoc }, { upsert: true }, (error, result) => {
                                    this.assert.equal(error, null); // 寫入資料庫失敗擲出錯誤，中斷Node
                                    resolve(result);
                                });
                            } else {
                                resolve();
                            }
                        });
                    };

                    let did_idx = userInfo.bind_devices.indexOf(device_id);
                    if (did_idx >= 0) {
                        userInfo.bind_devices.splice(did_idx, 1); // 移除用戶內紀錄的裝置device_id
                        let userAddDoc = {
                            openid: openid,
                            bind_devices: userInfo.bind_devices
                        };
                        this.updateWeixinUser(userAddDoc).then(() => {
                            runDeviceUpdateTask();
                        });
                    } else {
                        runDeviceUpdateTask();
                    }
                });
            });
        }
    }

    public fetchUserDeviceList(openid) {
        // 若沒有初始化Mongodb，則直接回調
        if (!openid) {
            return new Promise<any>((resolve, reject) => { reject('Need initial mongodb or param error'); });
        } else {
            return new Promise((resolve) => {
                this.fetchWeixinUser(openid).then((userInfo) => {
                    if (!userInfo || (userInfo && !userInfo.bind_devices)) {
                        resolve([]);
                        return;
                    }

                    if (userInfo.bind_devices.length === 0) {
                        resolve([]);
                    } else {
                        let query = { '$or': [] };
                        for (let i = 0; i < userInfo.bind_devices.length; i++) {
                            query['$or'].push({ device_id: userInfo.bind_devices[i] });
                        }

                        let json = { device_list: [] };
                        let collect = this.db.collection(this.dbcfg.COLL_WEIXIN_DEVICES);
                        collect.find(query).each((error, doc) => {
                            this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node

                            if (doc !== null) {
                                json.device_list.push({
                                    product_id: doc.product_id,
                                    device_id: doc.device_id
                                });
                            } else {
                                // 資料結束時doc為null
                                resolve(json);
                            }
                        });
                    }
                });
            });
        }
    }

    /**
     更新裝置資訊(必須包含device_id)
     @return {Promise} 非同步工作的承諾；成功取得使用者資訊後，攜帶結果回覆
     */
    public updateDeviceInfo(deviceInfo) {
        if (!deviceInfo.device_id) {
            return new Promise<any>((resolve, reject) => { reject('Need initial mongodb or param error'); });
        } else {
            return new Promise<any>((resolve) => {
                let collect = this.db.collection(this.dbcfg.COLL_WEIXIN_DEVICES);

                // 更新資料庫
                collect.update({ device_id: deviceInfo.device_id }, { $set: deviceInfo }, { upsert: true }, (error, result) => {
                    this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                    resolve(result);
                });
            })
        }
    }

    /**
     根據指定的device_id於資料庫中取出使用者資料
     @return {Promise} 非同步工作的承諾；成功取得使用者資訊後，攜帶結果回覆
     */
    public fetchDeviceInfo(device_id) {
        if (!device_id) {
            return new Promise<any>((resolve, reject) => { reject('Need initial mongodb or param error'); });
        } else {
            return new Promise<any>((resolve) => {
                let collect = this.db.collection(this.dbcfg.COLL_WEIXIN_DEVICES);
                collect.findOne({ device_id: device_id }, (error, result) => {
                    this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                    resolve(result); // 找不到會回調null
                });
            })
        }
    }
}