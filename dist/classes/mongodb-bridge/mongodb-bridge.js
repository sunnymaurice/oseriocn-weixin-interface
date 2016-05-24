/// <reference path="../../../typings/tsd.d.ts" />
"use strict";
var MongodbBridge = (function () {
    function MongodbBridge(mongoDB, dbcfg) {
        this.assert = require('assert');
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
    MongodbBridge.prototype.updateWeixinUser = function (userInfo) {
        var _this = this;
        // 若沒有初始化Mongodb，則直接回調
        if (!userInfo.openid) {
            return new Promise(function (resolve, reject) { reject('Param error'); });
        }
        else {
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
            return new Promise(function (resolve) {
                // 根據使用者openid更新資料庫
                _this.wxUserColl.update({ openid: userInfo.openid }, { $set: userInfo }, { upsert: true }, function (error, result) {
                    _this.assert.equal(error, null); // 寫入資料庫失敗擲出錯誤，中斷Node
                    resolve(result);
                });
            });
        }
    };
    /**
     根據指定的openid於資料庫中取出使用者資料
     @return {Promise} 非同步工作的承諾；成功取得使用者資訊後，攜帶DB結果回覆
     */
    MongodbBridge.prototype.fetchWeixinUser = function (openid) {
        var _this = this;
        if (!openid) {
            return new Promise(function (resolve, reject) { reject('Param error'); });
        }
        else {
            return new Promise(function (resolve) {
                _this.wxUserColl.findOne({ openid: openid }, function (error, result) {
                    _this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                    resolve(result); // 找不到會回調null
                });
            });
        }
    };
    /**
     更新基礎接口的Token
     @return {Promise} 非同步工作的承諾；成功更新基礎接口Token後，攜帶DB結果回覆
     */
    MongodbBridge.prototype.updateBaseToken = function (baseTokenNew) {
        var _this = this;
        if (!baseTokenNew) {
            return new Promise(function (resolve, reject) { reject('Param error'); });
        }
        else {
            return new Promise(function (resolve) {
                _this.baseTokenColl.findOne({}, function (err, doc) {
                    if (doc === null) {
                        // 資料庫內尚未有Token的紀錄，進行新增
                        _this.baseTokenColl.insertOne(baseTokenNew, function (error, result) {
                            _this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                            resolve(result);
                        });
                    }
                    else {
                        // 更新資料庫
                        _this.baseTokenColl.update({ _id: doc._id }, { $set: baseTokenNew }, { upsert: true }, function (error, result) {
                            _this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                            resolve(result);
                        });
                    }
                });
            });
        }
    };
    /**
     於資料庫中取出微信公眾平台基礎接口的Access Token
     @return {Promise} 非同步工作的承諾；成功取出基礎接口的Access Token後，攜帶DB結果回覆
     */
    MongodbBridge.prototype.fetchBaseToken = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.baseTokenColl.findOne({}, function (error, result) {
                _this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                resolve(result); // 找不到會回調null
            });
        });
    };
    /**
     更新生成jsapi所需的Ticket
     @return {Promise} 非同步工作的承諾；成功更新jsapi所需的Ticket後，攜帶DB結果回覆
     */
    MongodbBridge.prototype.updateJsapiTicket = function (jsapiTicketNew) {
        var _this = this;
        if (!jsapiTicketNew) {
            return new Promise(function (resolve, reject) { reject('Param error'); });
        }
        else {
            return new Promise(function (resolve) {
                _this.jsapiColl.findOne({}, function (err, doc) {
                    if (doc === null) {
                        // 資料庫內尚未有Token的紀錄，進行新增
                        _this.jsapiColl.insertOne(jsapiTicketNew, function (error, result) {
                            _this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                            resolve(result);
                        });
                    }
                    else {
                        // 更新資料庫
                        _this.jsapiColl.update({ _id: doc._id }, { $set: jsapiTicketNew }, { upsert: true }, function (error, result) {
                            _this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                            resolve(result);
                        });
                    }
                });
            });
        }
    };
    /**
     於資料庫中取出微信JSSDK生成簽名用的JSAPI Ticket
     @return {Promise} 非同步工作的承諾；成功取出微信JSSDK生成簽名用的JSAPI Ticket後，攜帶結果回覆
     */
    MongodbBridge.prototype.fetchJsapiTicket = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.jsapiColl.findOne({}, function (error, result) {
                _this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                resolve(result); // 找不到會回調null
            });
        });
    };
    /**
     添加使用者綁定裝置的資料
     @param {string} openid 微信使用者的對此公眾號的唯一id
     @param {string} device_id 裝置的唯一id
     @param {string} product_id 裝置的產品型號
     */
    MongodbBridge.prototype.addUserBindDevice = function (openid, device_id, product_id) {
        var _this = this;
        // 若沒有初始化Mongodb，則直接回調
        if (!openid || !device_id) {
            return new Promise(function (resolve, reject) { reject('Param error'); });
        }
        else {
            return new Promise(function (resolve) {
                _this.fetchWeixinUser(openid).then(function (userInfo) {
                    var runDeviceUpdateTask = function () {
                        _this.fetchDeviceInfo(device_id).then(function (deviceInfo) {
                            var deviceAddDoc = {
                                product_id: product_id ? product_id : null,
                                device_id: device_id,
                                bind_users: deviceInfo && deviceInfo.bind_users ? deviceInfo.bind_users : []
                            };
                            if (deviceAddDoc.bind_users.indexOf(openid) < 0) {
                                deviceAddDoc.bind_users.push(openid);
                            }
                            // 根據使用者device_id更新資料庫
                            var collect = _this.db.collection(_this.dbcfg.COLL_WEIXIN_DEVICES);
                            collect.update({ device_id: deviceAddDoc.device_id }, { $set: deviceAddDoc }, { upsert: true }, function (error, result) {
                                _this.assert.equal(error, null); // 寫入資料庫失敗擲出錯誤，中斷Node
                                resolve(result);
                            });
                        });
                    };
                    if (!userInfo) {
                        userInfo = { openid: openid };
                    }
                    if (!userInfo.bind_devices) {
                        userInfo.bind_devices = [];
                    }
                    if (userInfo.bind_devices.indexOf(device_id) < 0) {
                        userInfo.bind_devices.push(device_id);
                        var userAddDoc = {
                            openid: openid,
                            bind_devices: userInfo.bind_devices
                        };
                        _this.updateWeixinUser(userAddDoc).then(function () {
                            runDeviceUpdateTask();
                        });
                    }
                    else {
                        runDeviceUpdateTask();
                    }
                });
            });
        }
    };
    MongodbBridge.prototype.removeUserBindDevice = function (openid, device_id) {
        var _this = this;
        // 若沒有初始化Mongodb，則直接回調
        if (!openid || !device_id) {
            return new Promise(function (resolve, reject) { reject('Param error'); });
        }
        else {
            return new Promise(function (resolve) {
                _this.fetchWeixinUser(openid).then(function (userInfo) {
                    if (!userInfo || (userInfo && !userInfo.bind_devices)) {
                        resolve();
                        return;
                    }
                    var runDeviceUpdateTask = function () {
                        _this.fetchDeviceInfo(device_id).then(function (deviceInfo) {
                            if (!deviceInfo || (deviceInfo && !deviceInfo.bind_users)) {
                                resolve();
                                return;
                            }
                            var uid_idx = deviceInfo.bind_users.indexOf(openid);
                            if (uid_idx >= 0) {
                                deviceInfo.bind_users.splice(uid_idx, 1); // 移除裝置內紀錄的用戶openid
                                var deviceAddDoc = {
                                    device_id: device_id,
                                    bind_users: deviceInfo.bind_users
                                };
                                // 根據使用者device_id更新資料庫
                                var collect = _this.db.collection(_this.dbcfg.COLL_WEIXIN_DEVICES);
                                collect.update({ device_id: deviceAddDoc.device_id }, { $set: deviceAddDoc }, { upsert: true }, function (error, result) {
                                    _this.assert.equal(error, null); // 寫入資料庫失敗擲出錯誤，中斷Node
                                    resolve(result);
                                });
                            }
                            else {
                                resolve();
                            }
                        });
                    };
                    var did_idx = userInfo.bind_devices.indexOf(device_id);
                    if (did_idx >= 0) {
                        userInfo.bind_devices.splice(did_idx, 1); // 移除用戶內紀錄的裝置device_id
                        var userAddDoc = {
                            openid: openid,
                            bind_devices: userInfo.bind_devices
                        };
                        _this.updateWeixinUser(userAddDoc).then(function () {
                            runDeviceUpdateTask();
                        });
                    }
                    else {
                        runDeviceUpdateTask();
                    }
                });
            });
        }
    };
    MongodbBridge.prototype.fetchUserDeviceList = function (openid) {
        var _this = this;
        // 若沒有初始化Mongodb，則直接回調
        if (!openid) {
            return new Promise(function (resolve, reject) { reject('Need initial mongodb or param error'); });
        }
        else {
            return new Promise(function (resolve) {
                _this.fetchWeixinUser(openid).then(function (userInfo) {
                    if (!userInfo || (userInfo && !userInfo.bind_devices)) {
                        resolve([]);
                        return;
                    }
                    if (userInfo.bind_devices.length === 0) {
                        resolve([]);
                    }
                    else {
                        var query = { '$or': [] };
                        for (var i = 0; i < userInfo.bind_devices.length; i++) {
                            query['$or'].push({ device_id: userInfo.bind_devices[i] });
                        }
                        var json_1 = { device_list: [] };
                        var collect = _this.db.collection(_this.dbcfg.COLL_WEIXIN_DEVICES);
                        collect.find(query).each(function (error, doc) {
                            _this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                            if (doc !== null) {
                                json_1.device_list.push({
                                    product_id: doc.product_id,
                                    device_id: doc.device_id
                                });
                            }
                            else {
                                // 資料結束時doc為null
                                resolve(json_1);
                            }
                        });
                    }
                });
            });
        }
    };
    /**
     更新裝置資訊(必須包含device_id)
     @return {Promise} 非同步工作的承諾；成功取得使用者資訊後，攜帶結果回覆
     */
    MongodbBridge.prototype.updateDeviceInfo = function (deviceInfo) {
        var _this = this;
        if (!deviceInfo.device_id) {
            return new Promise(function (resolve, reject) { reject('Need initial mongodb or param error'); });
        }
        else {
            return new Promise(function (resolve) {
                var collect = _this.db.collection(_this.dbcfg.COLL_WEIXIN_DEVICES);
                // 更新資料庫
                collect.update({ device_id: deviceInfo.device_id }, { $set: deviceInfo }, { upsert: true }, function (error, result) {
                    _this.assert.equal(error, null); // 寫入資料庫失敗執出錯誤，中斷Node
                    resolve(result);
                });
            });
        }
    };
    /**
     根據指定的device_id於資料庫中取出使用者資料
     @return {Promise} 非同步工作的承諾；成功取得使用者資訊後，攜帶結果回覆
     */
    MongodbBridge.prototype.fetchDeviceInfo = function (device_id) {
        var _this = this;
        if (!device_id) {
            return new Promise(function (resolve, reject) { reject('Need initial mongodb or param error'); });
        }
        else {
            return new Promise(function (resolve) {
                var collect = _this.db.collection(_this.dbcfg.COLL_WEIXIN_DEVICES);
                collect.findOne({ device_id: device_id }, function (error, result) {
                    _this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                    resolve(result); // 找不到會回調null
                });
            });
        }
    };
    return MongodbBridge;
}());
exports.MongodbBridge = MongodbBridge;
