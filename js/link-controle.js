const linkControleCache = new Map()
let linkControleWachtrij = Promise.resolve()

function controleerYoutubeLink(youtubeUrl) {
  if (linkControleCache.has(youtubeUrl)) return Promise.resolve(linkControleCache.get(youtubeUrl))

  linkControleWachtrij = linkControleWachtrij.then(async () => {
    await new Promise(r => setTimeout(r, 150))
    try {
      const response = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(youtubeUrl) + '&format=json')
      // 401/403 betekent dat oEmbed de video niet mag insluiten (privé, of "insluiten uitgeschakeld" door
      // de uploader) - niet per se dat de video weg is. Bevestigd via een echte, publiek speelbare video
      // met insluiten uitgeschakeld (oEmbed gaf 401, de youtube.com/watch-pagina zelf gewoon 200 met
      // playabilityStatus OK). Musicwall speelt YouTube-video's af via die echte watch-pagina in een eigen
      // venster (open-video, main.js), niet via een insluiting, dus "insluiten uitgeschakeld" is hier geen
      // probleem - dat treft alleen de jukebox's IFrame-speler (zie ## Jukebox-gedrag). Alleen een status
      // die duidelijk "video bestaat niet (meer)" betekent (bv. 400/404) telt hier als onbeschikbaar.
      const beschikbaar = response.ok || response.status === 401 || response.status === 403
      linkControleCache.set(youtubeUrl, beschikbaar)
      return beschikbaar
    } catch (e) {
      return true
    }
  })
  return linkControleWachtrij
}

function controleerKaartenInContainer(container) {
  container.querySelectorAll('[data-youtube-url]').forEach(el => {
    const url = el.dataset.youtubeUrl
    if (!url) return
    controleerYoutubeLink(url).then(beschikbaar => {
      if (beschikbaar) return
      const badge = el.querySelector('.card-warning, .media-warning')
      if (badge) badge.classList.remove('verborgen')
    })
  })
}

window.controleerYoutubeLink = controleerYoutubeLink
window.controleerKaartenInContainer = controleerKaartenInContainer
