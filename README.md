# heresharshad.com coming soon page

A single-file, dependency-free coming soon page for heresharshad.com.
Everything lives in `index.html`. The page is HTML, CSS and a small amount of vanilla JavaScript (dark mode is a glossy black, light mode a paper-white drafting table); there is no build step and no framework.

## Files

- `index.html` : the page (HTML, CSS and JS in one file)
- `CNAME` : tells GitHub Pages to serve the site at heresharshad.com
- `.nojekyll` : stops GitHub from running Jekyll on the repo
- `README.md` : this file

## Publish on GitHub Pages

1. Create a new public repository on GitHub, for example `heresharshad-site`.
2. Upload these files to the root of the repo (drag and drop in the browser works, or use git):

       git init
       git add .
       git commit -m "Coming soon page"
       git branch -M main
       git remote add origin https://github.com/YOUR-USERNAME/heresharshad-site.git
       git push -u origin main

3. In the repo, open Settings, then Pages. Under "Build and deployment", set Source to "Deploy from a branch", pick `main` and `/ (root)`, and save.
4. Still on the Pages screen, confirm the custom domain shows `heresharshad.com` (the CNAME file fills this in). Tick "Enforce HTTPS" once the certificate is issued, usually within an hour.

## Point the domain at GitHub

In your domain registrar's DNS settings add:

| Type  | Host | Value                  |
|-------|------|------------------------|
| A     | @    | 185.199.108.153        |
| A     | @    | 185.199.109.153        |
| A     | @    | 185.199.110.153        |
| A     | @    | 185.199.111.153        |
| CNAME | www  | YOUR-USERNAME.github.io |

DNS can take anywhere from a few minutes to a day to propagate. GitHub's current list of IPs is in their docs at docs.github.com/pages if these ever change.

## Editing the page

- Headline, intro text and the two contact buttons are near the bottom of the `<body>` in `index.html`.
- Colours are CSS variables at the top of the `<style>` block: the `:root` set is dark mode, the `html.lights-on` set is light mode.
- Two modes. Dark is the default; pulling (or clicking) the brass pull chain on the pendant at the top right turns the lights on, which swaps the CSS variables under `html.lights-on` and starts the grid runners drawn on the `#runners` canvas. The pendant is the inline SVG inside `.lamp`; the pull chain is the `.cord` button and its length is `--cord`. Contact links live in the `.contact` block at the bottom right. Runner count, speed and colour are in the `spawn()` and `stepRunners()` functions.
