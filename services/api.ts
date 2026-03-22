// API 服务封装
const cloud = wx.cloud;

/**
 * 调用云函数
 */
export function callFunction(name: string, data: object = {}): Promise<any> {
  return cloud.callFunction({
    name,
    data
  }).then(res => res as any).catch(err => {
    console.error(`云函数 ${name} 调用失败`, err);
    throw err;
  });
}

/**
 * 上传文件到云存储
 */
export function uploadFile(cloudPath: string, filePath: string): Promise<any> {
  return cloud.uploadFile({
    cloudPath,
    filePath
  }).then(res => res as any);
}

/**
 * 下载云存储文件
 */
export function downloadFile(fileID: string): Promise<any> {
  return cloud.downloadFile({
    fileID
  }).then(res => res as any);
}
