const linkControleCache = new Map()
let linkControleWachtrij = Promise.resolve()

function controleerYoutubeLink(youtubeUrl) {
  if (linkControleCache.has(youtubeUrl)) return Promise.resolve(linkControleCache.get(youtubeUrl))

  linkControleWachtrij = linkControleWachtrij.then(async () => {
    await new Promise(r => setTimeout(r, 150))
    try {
      const response = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(youtubeUrl) + '&format=json')
      const beschikbaar = response.ok
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
