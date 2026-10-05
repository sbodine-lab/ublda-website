export default {
  fetch(request: Request) {
    const url = new URL(request.url)
    url.protocol = 'https:'
    url.host = 'ublda.org'
    url.port = ''
    return Response.redirect(url.toString(), 308)
  },
}
