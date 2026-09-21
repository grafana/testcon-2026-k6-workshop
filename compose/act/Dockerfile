FROM docker:29-cli@sha256:018edbc908e08fcc9dbf029c812c34251e9b4719e6f71ca0e5eae2a987d014ca

RUN apk add --no-cache curl bash \
    && curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/nektos/act/master/install.sh | bash -s -- -b /usr/local/bin

COPY actrc /root/.config/act/actrc

ENTRYPOINT ["tail", "-f", "/dev/null"]
