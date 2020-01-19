const isParameterRef = (part) => part[0] === '{' && part[part.length - 1] === '}'

// URLs is an array of unspoilt OpenAPI-style URLs. Input is the user input.
// If `fuzzyMatch` is true, URLs with a matching beginning are returned in
// addition to the exact match.
const findMatchingUrls = (urls, input, fuzzyMatch = false) => {
  const getMatch = (full, partial) => {
    const isParameterRef = (part) => part[0] === '{' && part[part.length - 1] === '}'

    const fullParts = full.split('/').filter(Boolean)
    const partialParts = partial.split('/').filter(Boolean)

    if (!fuzzyMatch && fullParts.length !== partialParts.length) return false

    const isMatch = partialParts.every((partialPart, idx) => {
      const fullPart = fullParts[idx]
      if (!fullPart) return false

      // This is kind of a hack. 99% `in: part` parameters I've seen span
      // an entire URL part, like `/namespace/{namespace}/pods`. Therefore,
      // we only use this simplictic detection instead of a smarter matcine
      // (like we could, against the relevant parameter's format, etc.).
      if (isParameterRef(fullPart))
        return true

      // The last partial part only needs to has the same start as the relevant
      // full part.
      return (idx === partialParts.length - 1 && fuzzyMatch) ?
        fullPart.startsWith(partialPart) :
        partialPart === fullPart
    })

    if (!isMatch) return false

    return '/' + fullParts.join('/')
    return '/' + fullParts.map((fullPart, idx) => isParameterRef(fullPart) ?
      (partialParts[idx] || fullPart) :
      fullPart).join('/')
  }

  return urls.map(path => getMatch(path, input)).filter(Boolean)
}

// Go through the full path (e.g. `/api/v1/namespaces/{namespace}/pods`),
// and replace parameter references with the partial part at the same index.
// This allows us to continue autocompletion after user has entered
// that parameter.
const fillUrlFromPartial = (url, partial) => {
  const partialParts = partial.split('/').filter(Boolean)

  return '/' + url.split('/')
    .filter(Boolean)
    .map((fullPart, idx) => isParameterRef(fullPart) ?
        (partialParts[idx] || fullPart) :
        fullPart
    )
    .join('/')
}

module.exports = { fillUrlFromPartial, findMatchingUrls }
