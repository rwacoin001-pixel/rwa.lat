/** Conventional city initials; unknown/localized cities fall back to the readable country code. */
export function communityCityCode(city: string, countryCode: string): string {
  const cities: Record<string, string> = {
    深圳:'sz',shenzhen:'sz',广州:'gz',guangzhou:'gz',北京:'bj',beijing:'bj',上海:'sh',shanghai:'sh',
    杭州:'hz',hangzhou:'hz',成都:'cd',chengdu:'cd',重庆:'cq',chongqing:'cq',武汉:'wh',wuhan:'wh',
    南京:'nj',nanjing:'nj',苏州:'su',suzhou:'su',天津:'tj',tianjin:'tj',西安:'xa',"xi'an":'xa',xian:'xa',
    长沙:'cs',changsha:'cs',厦门:'xm',xiamen:'xm',福州:'fz',fuzhou:'fz',郑州:'zz',zhengzhou:'zz',
    青岛:'qd',qingdao:'qd',济南:'jn',jinan:'jn',宁波:'nb',ningbo:'nb',东莞:'dg',dongguan:'dg',
    佛山:'fs',foshan:'fs',珠海:'zh',zhuhai:'zh',合肥:'hf',hefei:'hf',昆明:'km',kunming:'km',
    贵阳:'gy',guiyang:'gy',南宁:'nn',nanning:'nn',南昌:'nc',nanchang:'nc',海口:'hk',haikou:'hk',
    大连:'dl',dalian:'dl',沈阳:'sy',shenyang:'sy',哈尔滨:'heb',harbin:'heb',长春:'cc',changchun:'cc',
    太原:'ty',taiyuan:'ty',石家庄:'sjz',shijiazhuang:'sjz',无锡:'wx',wuxi:'wx',温州:'wz',wenzhou:'wz',
    香港:'hk','hong kong':'hk',澳门:'mo',macau:'mo',台北:'tb',taipei:'tb',新加坡:'sg',singapore:'sg',
    东京:'ty',tokyo:'ty',伦敦:'ldn',london:'ldn','new york':'nyc',纽约:'nyc','los angeles':'la',洛杉矶:'la',
  }
  const key = city.trim().toLowerCase().replace(/市$| city$/,'')
  if (cities[key]) return cities[key]
  if (/^[a-z][a-z\s-]+$/.test(key)) {
    const words = key.split(/[\s-]+/)
    return words.length > 1 ? words.map(w=>w[0]).join('').slice(0,7) : key.slice(0,3)
  }
  return countryCode.toLowerCase()
}
