"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeUR = void 0;
var miniCbor_1 = require("./miniCbor");
var bc_bech32_1 = require("bc-bech32");
var utils_1 = require("./utils");
var composeUR = function (payload, type) {
    // console.log('----------  生成二维码 composeUR 函数 ：', payload, type);
    if (type === void 0) { type = 'bytes'; }
    return "ur:" + type + "/" + payload;
};
var composeDigest = function (payload, digest) {
    // console.log('----------  生成二维码 composeDigest 函数 ：', payload, digest);
    return digest + "/" + payload;
};
var composeSequencing = function (payload, index, total) {
    // console.log('----------  生成二维码 composeSequencing 函数 ：', payload, index, total);
    return index + 1 + "of" + total + "/" + payload;
};
var composeHeadersToFragments = function (fragments, digest, type) {
    // console.log('----------  生成二维码 composeHeadersToFragments 函数 ：', fragments, digest, type);
    if (type === void 0) { type = 'bytes'; }
    if (fragments.length === 1) {
        return [composeUR(fragments[0])];
    }
    else {
        return fragments.map(function (f, index) {
            return utils_1.compose3(
                function (payload) { return composeUR(payload, type); }, 
                function (payload) { return composeSequencing(payload, index, fragments.length); }, 
                function (payload) { return composeDigest(payload, digest); 
            })(f);
        });
    }
};
exports.encodeUR = function (payload, fragmentCapacity) {
    if (fragmentCapacity === void 0) { fragmentCapacity = 200; }
    var cborPayload = miniCbor_1.encodeSimpleCBOR(payload);
    var bc32Payload = bc_bech32_1.encodeBc32Data(cborPayload);
    var digest = utils_1.sha256Hash(Buffer.from(cborPayload, 'hex')).toString('hex');
    var bc32Digest = bc_bech32_1.encodeBc32Data(digest);
    var fragments = bc32Payload.match(new RegExp('.{1,' + fragmentCapacity + '}', 'g'));
    // console.log('----------  生成二维码 fragments ：', JSON.stringify(fragments));
    var result = composeHeadersToFragments(fragments, bc32Digest, 'bytes');
    // console.log('----------  生成二维码 result ：', JSON.stringify(result));
    return result;
};
//# sourceMappingURL=encodeUR.js.map